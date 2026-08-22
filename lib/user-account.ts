export type HubAccount = {
  avatarUrl: string | null;
  displayName: string;
  email: string;
  initials: string;
};

type HubAccountUser = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  profilePictureUrl?: string | null;
};

function firstCharacter(value: string): string {
  return Array.from(value.trim())[0] ?? "?";
}

export function accountInitials(displayName: string, email: string): string {
  const words = displayName.trim().split(/\s+/u).filter(Boolean);
  if (words.length > 1) {
    return `${firstCharacter(words[0])}${firstCharacter(words.at(-1) ?? "")}`.toUpperCase();
  }
  return firstCharacter(words[0] || email).toUpperCase();
}

export function safeAvatarUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isWorkosCdn =
      url.hostname === "workoscdn.com" || url.hostname.endsWith(".workoscdn.com");
    return url.protocol === "https:" && isWorkosCdn ? url.toString() : null;
  } catch {
    return null;
  }
}

export function hubAccountFromUser(user: HubAccountUser): HubAccount {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const displayName = user.name?.trim() || fullName || user.email;
  return {
    avatarUrl: safeAvatarUrl(user.profilePictureUrl),
    displayName,
    email: user.email,
    initials: accountInitials(displayName, user.email),
  };
}
