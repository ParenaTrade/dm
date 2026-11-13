export type StreamInfo = {
  id: number;
  title: string;
  category: string;
  description: string;
  status: string;
  guestCode: string;
  chatLocked: boolean;
  slowModeSeconds: number;
  guestLimit: number;
  hostNickname: string;
  startedAt: string | null;
};

export type ParticipantInfo = {
  id: number;
  userId: number;
  nickname: string;
  role: string;
  status: string;
  cameraOn: boolean;
  micOn: boolean;
  handRaised: boolean;
  isScreenSharing: boolean;
  updatedAt: string;
};

export type ChatMessageInfo = {
  id: number;
  userId: number;
  nickname: string;
  role: string;
  accent: string;
  body: string;
  status: string;
  isPinned: boolean;
  createdAt: string;
};

export type ModeratorInfo = {
  id: number;
  nickname: string;
  addedBy: string;
  canDelete: boolean;
  canBan: boolean;
  note: string;
  createdAt: string;
};

export type ScheduleInfo = {
  id: number;
  day: string;
  time: string;
  title: string;
  category: string;
  isLive: boolean;
};

export type GiveawayInfo = {
  id: number;
  title: string;
  prize: string;
  status: string;
  winner: string;
  entries: number;
};

export const ROLE_LABELS: Record<string, string> = {
  host: "Yayıncı",
  moderator: "Moderatör",
  guest: "Konuk",
  viewer: "İzleyici",
};

export function roleBadgeClass(role: string) {
  switch (role) {
    case "host":
      return "bg-amber-400/20 text-amber-300 ring-amber-400/40";
    case "moderator":
      return "bg-cyan-400/20 text-cyan-300 ring-cyan-400/40";
    case "guest":
      return "bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-500/40";
    default:
      return "bg-white/10 text-white/70 ring-white/20";
  }
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "şimdi";
  if (mins < 60) return `${mins} dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa`;
  return `${Math.floor(hours / 24)} g`;
}
