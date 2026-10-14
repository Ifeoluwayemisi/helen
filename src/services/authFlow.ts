export const MIN_OWNER_CREDENTIAL_LENGTH = 4;

export interface OwnerSetupInput {
  name: string;
  email: string;
  credential: string;
}

export interface SetupStatus {
  checked: boolean;
  hasOwner: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const shouldShowOwnerSetup = (status: SetupStatus): boolean =>
  status.checked && !status.hasOwner;

export const validateOwnerSetupInput = (input: {
  name?: string;
  email?: string;
  credential?: string;
}): string | null => {
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim();
  const credential = input.credential ?? "";

  if (!name) return "Full name is required.";
  if (!email) return "Email is required.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  if (credential.length < MIN_OWNER_CREDENTIAL_LENGTH) {
    return `Password or PIN must be at least ${MIN_OWNER_CREDENTIAL_LENGTH} characters.`;
  }
  return null;
};

export const ownerSetupFailureMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Store owner setup failed. Please try again.";
};
