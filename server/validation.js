export class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
    this.status = 400;
  }
}

function getNormalizedEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new InputError("Enter a valid email address.");
  }
  return email;
}

export function normalizeEmailAddress(body) {
  return getNormalizedEmail(body?.email);
}

export function normalizeEmailVerification(body) {
  const email = getNormalizedEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    throw new InputError("Enter the six-digit verification code.");
  }
  return { email, code };
}

export function normalizeRegistration(body) {
  const email = getNormalizedEmail(body?.email);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!fullName || fullName.length > 120) {
    throw new InputError("Enter a name between 1 and 120 characters.");
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new InputError("Password must be at least 8 characters and no more than 72 UTF-8 bytes.");
  }

  return { email, fullName, password };
}

export function normalizeLogin(body) {
  const email = getNormalizedEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || Buffer.byteLength(password, "utf8") > 72) {
    throw new InputError("Enter a valid email address and password.");
  }

  return { email, password };
}

export function normalizeDisplayName(body) {
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  if (!fullName || fullName.length > 120) {
    throw new InputError("Enter a name between 1 and 120 characters.");
  }
  return fullName;
}

export function normalizeAdminDirectoryInput(body) {
  const fields = {
    displayName: "Public display name",
    roleTitle: "Role / title",
    department: "Department",
  };
  const result = {};

  for (const [field, label] of Object.entries(fields)) {
    const value = typeof body?.[field] === "string" ? body[field].trim() : "";
    if (!value || value.length > (field === "department" ? 160 : 120)) {
      throw new InputError(`${label} is required and must be within its character limit.`);
    }
    result[field] = value;
  }

  const publicContact = typeof body?.publicContact === "string"
    ? body.publicContact.trim()
    : "";
  if (publicContact.length > 240) {
    throw new InputError("Public contact must be 240 characters or fewer.");
  }

  return { ...result, publicContact };
}

export function toPublicAccount(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}
