import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  businessContracts,
  campaigns,
  qrCodes,
  users,
  dampingWallets,
  walletLedger,
  dampingPool,
  poolLedger,
  transactions,
  referrals,
  referralRewards,
  auditLogs,
  fraudReviews,
} from "@/db/schema";

/* ------------------------------------------------------------------ *
 * DampingVar finans motoru
 * Kural: frontend'den gelen hiçbir finansal orana güvenilmez.
 * İndirim, komisyon, havuz katkısı ve ödül SUNUCUDA hesaplanır.
 * ------------------------------------------------------------------ */

export type ContractRow = typeof businessContracts.$inferSelect;
export type CampaignRow = typeof campaigns.$inferSelect;

export type PriceBreakdown = {
  grossAmountCents: number;
  discountCents: number;
  dampingUsedCents: number;
  netAmountCents: number;
  commissionBaseCents: number;
  commissionRate: number;
  commissionCents: number;
  poolContributionCents: number;
  dampingEarnedCents: number;
};

export function discountFor(campaign: CampaignRow | null, grossCents: number): number {
  if (!campaign) return 0;
  if (campaign.minBasketCents && grossCents < campaign.minBasketCents) return 0;
  let discount = 0;
  if (campaign.type === "FIXED" || campaign.type === "PRODUCT") {
    discount = campaign.discountAmountCents || 0;
  } else {
    discount = Math.round((grossCents * (campaign.discountPercent || 0)) / 100);
    if (campaign.maxDiscountCents > 0) discount = Math.min(discount, campaign.maxDiscountCents);
  }
  return Math.max(0, Math.min(discount, grossCents));
}

export function commissionBaseFor(contract: ContractRow, gross: number, discount: number, damping: number): number {
  switch (contract.commissionBase) {
    case "GROSS":
      return gross;
    case "NET_AFTER_DISCOUNT":
      return Math.max(0, gross - discount);
    case "AFTER_DAMPING":
    default:
      return Math.max(0, gross - discount - damping);
  }
}

export function priceTransaction(input: {
  grossAmountCents: number;
  campaign: CampaignRow | null;
  contract: ContractRow;
  dampingUsedCents: number;
}): PriceBreakdown {
  const gross = Math.max(0, Math.round(input.grossAmountCents));
  const discount = discountFor(input.campaign, gross);
  const damping = Math.max(0, Math.min(Math.round(input.dampingUsedCents), Math.max(0, gross - discount)));
  const net = Math.max(0, gross - discount - damping);
  const base = commissionBaseFor(input.contract, gross, discount, damping);
  const commission = Math.round(base * input.contract.commissionRate) + input.contract.fixedFeeCents;
  const poolContribution = Math.round(Math.max(0, gross - discount) * input.contract.poolContributionRate);
  const dampingEarned = Math.round(Math.max(0, gross - discount) * input.contract.dampingRewardRate);
  return {
    grossAmountCents: gross,
    discountCents: discount,
    dampingUsedCents: damping,
    netAmountCents: net,
    commissionBaseCents: base,
    commissionRate: input.contract.commissionRate,
    commissionCents: commission,
    poolContributionCents: poolContribution,
    dampingEarnedCents: dampingEarned,
  };
}

/* --------------------------- doğrulama ---------------------------- */

export type ValidationIssue = { code: string; message: string };

export function validateCampaignUsage(
  campaign: CampaignRow | null,
  usedCount: number,
  now = new Date()
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!campaign) return issues;
  if (campaign.status !== "PUBLISHED") {
    issues.push({ code: "CAMPAIGN_INACTIVE", message: "Kampanya yayında değil." });
  }
  if (new Date(campaign.startsAt) > now) {
    issues.push({ code: "CAMPAIGN_NOT_STARTED", message: "Kampanya henüz başlamadı." });
  }
  if (campaign.endsAt && new Date(campaign.endsAt) < now) {
    issues.push({ code: "CAMPAIGN_ENDED", message: "Kampanya süresi dolmuş." });
  }
  if (campaign.usageLimit && usedCount >= campaign.usageLimit) {
    issues.push({ code: "USAGE_LIMIT", message: "Kampanya kullanım limiti dolmuş." });
  }
  if (campaign.timeStart && campaign.timeEnd) {
    const [sh, sm] = campaign.timeStart.split(":").map(Number);
    const [eh, em] = campaign.timeEnd.split(":").map(Number);
    const mins = now.getHours() * 60 + now.getMinutes();
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (mins < start || mins > end) {
      issues.push({
        code: "OUT_OF_HOURS",
        message: `Kampanya yalnızca ${campaign.timeStart}–${campaign.timeEnd} arasında geçerli.`,
      });
    }
  }
  if (campaign.days && Array.isArray(campaign.days) && campaign.days.length > 0) {
    if (!campaign.days.includes(now.getDay())) {
      issues.push({ code: "OUT_OF_DAYS", message: "Kampanya bugün geçerli değil." });
    }
  }
  return issues;
}

/* --------------------------- atomik satış -------------------------- */

export type SaleInput = {
  businessId: string;
  campaignId?: string | null;
  code?: string | null;
  grossAmountCents: number;
  dampingUseCents?: number;
  paymentMethod?: string;
  actorEmail: string;
  actorRole?: string;
  note?: string;
};

export type SaleResult = {
  ok: boolean;
  issues: ValidationIssue[];
  receiptNo?: string;
  breakdown?: PriceBreakdown;
  transactionId?: string;
  dampingRemainingCents?: number;
  referralRewardCents?: number;
};

function receiptNo(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `DMP-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

export async function completeSale(input: SaleInput): Promise<SaleResult> {
  const issues: ValidationIssue[] = [];

  return await db.transaction(async (tx) => {
    /* 1-2. işletme + sözleşme (kilitli) */
    const [biz] = await tx.select().from(businesses).where(eq(businesses.id, input.businessId));
    if (!biz) return { ok: false, issues: [{ code: "NO_BUSINESS", message: "İşletme bulunamadı." }] };

    const [contract] = await tx
      .select()
      .from(businessContracts)
      .where(and(eq(businessContracts.businessId, input.businessId), eq(businessContracts.active, true)));
    if (!contract) return { ok: false, issues: [{ code: "NO_CONTRACT", message: "Aktif işletme sözleşmesi yok." }] };

    /* 3. kampanya + kullanım hakkı */
    let campaign: CampaignRow | null = null;
    if (input.campaignId) {
      const [c] = await tx.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      campaign = c ?? null;
    } else if (input.code) {
      const [c] = await tx.select().from(campaigns).where(eq(campaigns.code, input.code));
      campaign = c ?? null;
    }

    /* 4. QR kodu — aynı QR iki kez kullanılamaz (satır kilidi) */
    let qrRow: typeof qrCodes.$inferSelect | null = null;
    if (input.code) {
      const locked = await tx.execute(
        sql`select id, status, business_id, campaign_id, customer_id from qr_codes where code = ${input.code} for update`
      );
      const row = (locked.rows ?? [])[0] as
        | { id: string; status: string; business_id: string; campaign_id: string | null; customer_id: string | null }
        | undefined;
      if (row) {
        if (row.status === "REDEEMED") {
          return {
            ok: false,
            issues: [{ code: "QR_USED", message: "Bu QR kodu daha önce kullanılmış." }],
          };
        }
        if (row.business_id !== input.businessId) {
          return {
            ok: false,
            issues: [{ code: "QR_WRONG_BUSINESS", message: "QR kodu başka bir işletmeye ait." }],
          };
        }
        qrRow = {
          id: row.id,
          code: input.code,
          businessId: row.business_id,
          campaignId: row.campaign_id,
          customerId: row.customer_id,
          status: row.status,
          createdAt: new Date(),
          redeemedAt: null,
          transactionId: null,
        };
        if (!campaign && row.campaign_id) {
          const [c] = await tx.select().from(campaigns).where(eq(campaigns.id, row.campaign_id));
          campaign = c ?? null;
        }
      }
    }

    /* 5. kampanya kuralları */
    if (campaign) {
      const used = await tx.execute(
        sql`select count(*)::int as n from store_transactions where campaign_id = ${campaign.id} and status <> 'CANCELLED'`
      );
      const usedCount = Number((used.rows ?? [])[0]?.n ?? 0);
      issues.push(...validateCampaignUsage(campaign, usedCount));
    }
    if (issues.length) return { ok: false, issues };

    /* 6. müşteri + cüzdan kilidi */
    let customerId: string | null = qrRow?.customerId ?? null;
    if (!customerId && input.code) {
      const [q] = await tx.select().from(qrCodes).where(eq(qrCodes.code, input.code));
      customerId = q?.customerId ?? null;
    }

    /* 7-8. fiyatlandırma (sunucu tarafında) */
    const requestedDamping = Math.max(0, Math.round(input.dampingUseCents ?? 0));
    let dampingAllowed = requestedDamping;
    if (customerId && requestedDamping > 0) {
      const locked = await tx.execute(
        sql`select id, available_cents from damping_wallets where user_id = ${customerId} for update`
      );
      const w = (locked.rows ?? [])[0] as { id: string; available_cents: number } | undefined;
      if (!w || Number(w.available_cents) < requestedDamping) {
        return {
          ok: false,
          issues: [
            {
              code: "INSUFFICIENT_DAMPING",
              message: `Damping Hane bakiyesi yetersiz. Kullanılabilir: ${((Number(w?.available_cents ?? 0)) / 100).toFixed(2)} TL`,
            },
          ],
        };
      }
      dampingAllowed = requestedDamping;
    } else {
      dampingAllowed = 0;
    }

    const breakdown = priceTransaction({
      grossAmountCents: input.grossAmountCents,
      campaign,
      contract,
      dampingUsedCents: dampingAllowed,
    });

    /* 9. satış kaydı */
    const rno = receiptNo();
    const [txRow] = await tx
      .insert(transactions)
      .values({
        businessId: input.businessId,
        campaignId: campaign?.id ?? null,
        customerId,
        qrCodeId: qrRow?.id ?? null,
        receiptNo: rno,
        grossAmountCents: breakdown.grossAmountCents,
        discountCents: breakdown.discountCents,
        dampingUsedCents: breakdown.dampingUsedCents,
        netAmountCents: breakdown.netAmountCents,
        commissionBaseCents: breakdown.commissionBaseCents,
        commissionRate: breakdown.commissionRate,
        commissionCents: breakdown.commissionCents,
        poolContributionCents: breakdown.poolContributionCents,
        dampingEarnedCents: breakdown.dampingEarnedCents,
        status: "COMPLETED",
        paymentMethod: input.paymentMethod ?? "NAKIT",
        note: input.note ?? null,
      })
      .returning();

    /* 10. QR kullanım işareti */
    if (qrRow) {
      await tx
        .update(qrCodes)
        .set({ status: "REDEEMED", redeemedAt: new Date(), transactionId: txRow.id })
        .where(eq(qrCodes.id, qrRow.id));
    }

    /* 11. Damping Hane: harcama + kazanç (ledger) */
    let walletRemaining = 0;
    if (customerId) {
      const [wallet] = await tx.select().from(dampingWallets).where(eq(dampingWallets.userId, customerId));
      if (wallet) {
        if (breakdown.dampingUsedCents > 0) {
          await tx.insert(walletLedger).values({
            walletId: wallet.id,
            userId: customerId,
            entryType: "SPEND",
            status: "SPENT",
            amountCents: -breakdown.dampingUsedCents,
            refType: "TRANSACTION",
            refId: txRow.id,
            description: `${biz.name} — kasa harcaması (${rno})`,
          });
        }
        if (breakdown.dampingEarnedCents > 0) {
          await tx.insert(walletLedger).values({
            walletId: wallet.id,
            userId: customerId,
            entryType: "EARN",
            status: "AVAILABLE",
            amountCents: breakdown.dampingEarnedCents,
            refType: "TRANSACTION",
            refId: txRow.id,
            description: `${biz.name} — damping kazancı (${rno})`,
          });
        }
        const available =
          wallet.availableCents - breakdown.dampingUsedCents + breakdown.dampingEarnedCents;
        if (available < 0) {
          throw new Error("NEGATIVE_BALANCE");
        }
        walletRemaining = available;
        await tx
          .update(dampingWallets)
          .set({
            availableCents: available,
            lifetimeEarnedCents: wallet.lifetimeEarnedCents + breakdown.dampingEarnedCents,
            lifetimeSpentCents: wallet.lifetimeSpentCents + breakdown.dampingUsedCents,
            updatedAt: new Date(),
          })
          .where(eq(dampingWallets.id, wallet.id));
      }
    }

    /* 12. Ortak havuz katkısı */
    if (breakdown.poolContributionCents > 0) {
      await tx.insert(poolLedger).values({
        businessId: input.businessId,
        direction: "CONTRIBUTE",
        amountCents: breakdown.poolContributionCents,
        refType: "TRANSACTION",
        refId: txRow.id,
        description: `${biz.name} — havuz katkısı (${rno})`,
      });
      await tx
        .update(dampingPool)
        .set({
          balanceCents: sql`${dampingPool.balanceCents} + ${breakdown.poolContributionCents}`,
          updatedAt: new Date(),
        })
        .where(eq(dampingPool.key, "GLOBAL"));
      // havuzdan karşılanan kısım
      if (breakdown.dampingEarnedCents > 0) {
        await tx.insert(poolLedger).values({
          businessId: input.businessId,
          direction: "CONSUME",
          amountCents: breakdown.dampingEarnedCents,
          refType: "TRANSACTION",
          refId: txRow.id,
          description: `${biz.name} — havuzdan karşılanan ödül (${rno})`,
        });
        await tx
          .update(dampingPool)
          .set({
            balanceCents: sql`${dampingPool.balanceCents} - ${breakdown.dampingEarnedCents}`,
            updatedAt: new Date(),
          })
          .where(eq(dampingPool.key, "GLOBAL"));
      }
    }

    /* 13. Tek seviye referral ödülü (A→B; B→C'de A'ya ödül yok) */
    let referralReward = 0;
    if (customerId) {
      const [ref] = await tx
        .select()
        .from(referrals)
        .where(and(eq(referrals.inviteeId, customerId), eq(referrals.status, "QUALIFIED")));
      if (ref) {
        const selfReferral = ref.inviterId === customerId;
        const flags: string[] = [];
        if (selfReferral) flags.push("SELF_REFERRAL");
        const prior = await tx.execute(
          sql`select count(*)::int as n from referral_rewards where inviter_id = ${ref.inviterId}`
        );
        if (Number((prior.rows ?? [])[0]?.n ?? 0) > 25) flags.push("EXCESSIVE_REFERRAL");

        const reward = Math.round(breakdown.commissionBaseCents * contract.referralRate);
        if (reward > 0) {
          await tx.insert(referralRewards).values({
            referralId: ref.id,
            transactionId: txRow.id,
            inviterId: ref.inviterId,
            amountCents: reward,
            status: flags.length ? "FRAUD_REVIEW" : "AVAILABLE",
          });
          if (flags.length) {
            await tx.insert(fraudReviews).values({
              transactionId: txRow.id,
              userId: customerId,
              reason: "Referral şüpheli davranış",
              signals: flags,
              status: "OPEN",
            });
          } else {
            referralReward = reward;
            const [inviterWallet] = await tx
              .select()
              .from(dampingWallets)
              .where(eq(dampingWallets.userId, ref.inviterId));
            if (inviterWallet) {
              await tx.insert(walletLedger).values({
                walletId: inviterWallet.id,
                userId: ref.inviterId,
                entryType: "REFERRAL",
                status: "AVAILABLE",
                amountCents: reward,
                refType: "REFERRAL",
                refId: ref.id,
                description: `Paylaş & Kazan ödülü (${rno})`,
              });
              await tx
                .update(dampingWallets)
                .set({
                  availableCents: inviterWallet.availableCents + reward,
                  lifetimeEarnedCents: inviterWallet.lifetimeEarnedCents + reward,
                  updatedAt: new Date(),
                })
                .where(eq(dampingWallets.id, inviterWallet.id));
            }
          }
        }
      }
    }

    /* 14. kampanya sayacı + audit */
    if (campaign) {
      await tx
        .update(campaigns)
        .set({ redemptions: sql`${campaigns.redemptions} + 1` })
        .where(eq(campaigns.id, campaign.id));
    }

    await tx.insert(auditLogs).values({
      actor: input.actorEmail,
      role: input.actorRole ?? "CASHIER",
      action: "TRANSACTION_COMPLETED",
      entityType: "store_transactions",
      entityId: txRow.id,
      meta: {
        receiptNo: rno,
        gross: breakdown.grossAmountCents,
        discount: breakdown.discountCents,
        dampingUsed: breakdown.dampingUsedCents,
        net: breakdown.netAmountCents,
        commission: breakdown.commissionCents,
      },
    });

    return {
      ok: true,
      issues: [],
      receiptNo: rno,
      breakdown,
      transactionId: txRow.id,
      dampingRemainingCents: walletRemaining,
      referralRewardCents: referralReward,
    };
  });
}

/* --------------------------- iade / reversal ----------------------- */

export async function reverseTransaction(transactionId: string, actor: string, reason: string) {
  return await db.transaction(async (tx) => {
    const locked = await tx.execute(
      sql`select id, status, business_id, customer_id, qr_code_id, gross_amount_cents, discount_cents, damping_used_cents, net_amount_cents, commission_cents, pool_contribution_cents, damping_earned_cents, campaign_id, receipt_no from store_transactions where id = ${transactionId} for update`
    );
    const row = (locked.rows ?? [])[0] as Record<string, unknown> | undefined;
    if (!row) return { ok: false, message: "İşlem bulunamadı." };
    if (row.status === "REVERSED") return { ok: false, message: "Bu işlem zaten iade edilmiş." };

    const gross = Number(row.gross_amount_cents);
    const dampingUsed = Number(row.damping_used_cents);
    const dampingEarned = Number(row.damping_earned_cents);
    const poolContribution = Number(row.pool_contribution_cents);

    const [rev] = await tx
      .insert(transactions)
      .values({
        businessId: row.business_id as string,
        campaignId: (row.campaign_id as string) ?? null,
        customerId: (row.customer_id as string) ?? null,
        qrCodeId: (row.qr_code_id as string) ?? null,
        receiptNo: `IAD-${(row.receipt_no as string).replace(/^DMP-/, "")}`,
        grossAmountCents: -gross,
        discountCents: -Number(row.discount_cents),
        dampingUsedCents: -dampingUsed,
        netAmountCents: -Number(row.net_amount_cents),
        commissionBaseCents: 0,
        commissionRate: 0,
        commissionCents: -Number(row.commission_cents),
        poolContributionCents: -poolContribution,
        dampingEarnedCents: -dampingEarned,
        status: "REVERSED",
        paymentMethod: "IADE",
        reversalOf: transactionId,
        note: reason,
      })
      .returning();

    await tx.update(transactions).set({ status: "REVERSED" }).where(eq(transactions.id, transactionId));

    if (row.customer_id) {
      const [wallet] = await tx.select().from(dampingWallets).where(eq(dampingWallets.userId, row.customer_id as string));
      if (wallet) {
        if (dampingEarned > 0) {
          await tx.insert(walletLedger).values({
            walletId: wallet.id,
            userId: row.customer_id as string,
            entryType: "REVERSE",
            status: "CANCELLED",
            amountCents: -dampingEarned,
            refType: "TRANSACTION",
            refId: transactionId,
            description: `İade: ${(row.receipt_no as string)} kazancı geri alındı`,
          });
        }
        if (dampingUsed > 0) {
          await tx.insert(walletLedger).values({
            walletId: wallet.id,
            userId: row.customer_id as string,
            entryType: "REVERSE",
            status: "AVAILABLE",
            amountCents: dampingUsed,
            refType: "TRANSACTION",
            refId: transactionId,
            description: `İade: ${(row.receipt_no as string)} harcaması iade edildi`,
          });
        }
        const available = wallet.availableCents + dampingUsed - dampingEarned;
        if (available < 0) throw new Error("NEGATIVE_BALANCE");
        await tx
          .update(dampingWallets)
          .set({
            availableCents: available,
            lifetimeEarnedCents: wallet.lifetimeEarnedCents - dampingEarned,
            lifetimeSpentCents: wallet.lifetimeSpentCents - dampingUsed,
            updatedAt: new Date(),
          })
          .where(eq(dampingWallets.id, wallet.id));
      }
    }

    // Havuz düzeltmesi: katkı geri alınır, havuzdan karşılanan ödül iade edilir.
    // REVERSE satırları kendi işaretini taşır (+/-), toplam her zaman ledger ile aynıdır.
    const poolDelta = -poolContribution + dampingEarned;
    if (poolContribution !== 0) {
      await tx.insert(poolLedger).values({
        businessId: row.business_id as string,
        direction: "REVERSE",
        amountCents: -poolContribution,
        refType: "TRANSACTION",
        refId: transactionId,
        description: `İade: ${(row.receipt_no as string)} havuz katkısı geri alındı`,
      });
    }
    if (dampingEarned !== 0) {
      await tx.insert(poolLedger).values({
        businessId: row.business_id as string,
        direction: "REVERSE",
        amountCents: dampingEarned,
        refType: "TRANSACTION",
        refId: transactionId,
        description: `İade: ${(row.receipt_no as string)} havuz ödülü iade edildi`,
      });
    }
    if (poolDelta !== 0) {
      await tx
        .update(dampingPool)
        .set({
          balanceCents: sql`${dampingPool.balanceCents} + ${poolDelta}`,
          updatedAt: new Date(),
        })
        .where(eq(dampingPool.key, "GLOBAL"));
    }

    await tx
      .update(referralRewards)
      .set({ status: "CANCELLED" })
      .where(eq(referralRewards.transactionId, transactionId));

    if (row.qr_code_id) {
      await tx.update(qrCodes).set({ status: "ACTIVE", redeemedAt: null }).where(eq(qrCodes.id, row.qr_code_id as string));
    }

    await tx.insert(auditLogs).values({
      actor,
      role: "MANAGER",
      action: "TRANSACTION_REVERSED",
      entityType: "store_transactions",
      entityId: transactionId,
      meta: { reason, reversalId: rev.id },
    });

    return { ok: true, message: "İade kaydı oluşturuldu.", reversalId: rev.id };
  });
}

export async function logAudit(
  actor: string,
  role: string,
  action: string,
  entityType: string,
  entityId: string | null,
  meta: Record<string, unknown> = {}
) {
  await db.insert(auditLogs).values({ actor, role, action, entityType, entityId, meta });
}

export async function latestTransactions(businessId: string, limit = 8) {
  return await db
    .select()
    .from(transactions)
    .where(eq(transactions.businessId, businessId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}
