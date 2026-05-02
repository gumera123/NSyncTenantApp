const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

admin.initializeApp();

const db = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
const deleteField = admin.firestore.FieldValue.delete;

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isAccountDeactivated(userData = {}) {
  const isActive = userData.isActive;
  const disabled = userData.disabled;
  const status = normalize(userData.status || userData.accountStatus || "");

  return (
    isActive === false ||
    normalize(isActive) === "false" ||
    disabled === true ||
    normalize(disabled) === "true" ||
    status === "inactive" ||
    status === "deactivated" ||
    status === "disabled"
  );
}

function isSuperAdmin(user, userRecord) {
  if (!user || !userRecord || isAccountDeactivated(userRecord)) {
    return false;
  }

  const role = normalize(userRecord.role);
  const email = normalize(user.email);
  const configuredAdminEmail = normalize(
    process.env.SUPER_ADMIN_EMAIL ||
      process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL ||
      "",
  );

  return Boolean(
    userRecord.isSuperAdmin ||
    role === "super admin" ||
    role === "superadmin" ||
    (configuredAdminEmail && email === configuredAdminEmail),
  );
}

async function requireSuperAdmin(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to perform this action.",
    );
  }

  const adminRef = db.collection("users").doc(request.auth.uid);
  const adminSnapshot = await adminRef.get();

  if (!adminSnapshot.exists) {
    throw new HttpsError(
      "permission-denied",
      "Your admin profile could not be found.",
    );
  }

  const adminData = adminSnapshot.data();
  const authUser = {
    uid: request.auth.uid,
    email: request.auth.token?.email || "",
  };

  if (!isSuperAdmin(authUser, adminData)) {
    throw new HttpsError(
      "permission-denied",
      "Only the Super Admin can manage user accounts.",
    );
  }

  return adminData;
}

async function updateAuthUser(userId, updates) {
  try {
    await admin.auth().updateUser(userId, updates);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }
  }
}

async function deleteAuthUser(userId) {
  try {
    await admin.auth().deleteUser(userId);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }
  }
}

exports.syncUserAccountAction = onCall(async (request) => {
  try {
    await requireSuperAdmin(request);

    const userId = String(request.data?.userId || "").trim();
    const action = String(request.data?.action || "")
      .trim()
      .toLowerCase();

    if (!userId) {
      throw new HttpsError("invalid-argument", "A userId is required.");
    }

    if (!["deactivate", "reactivate", "delete"].includes(action)) {
      throw new HttpsError(
        "invalid-argument",
        "The requested account action is not supported.",
      );
    }

    const userRef = db.collection("users").doc(userId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      if (action === "delete") {
        await deleteAuthUser(userId);
        return { ok: true, action, userId };
      }

      throw new HttpsError("not-found", "The user profile could not be found.");
    }

    if (action === "delete") {
      await deleteAuthUser(userId);
      await userRef.delete();
      return { ok: true, action, userId };
    }

    const disableAccount = action === "deactivate";

    await updateAuthUser(userId, { disabled: disableAccount });

    await userRef.set(
      {
        isActive: !disableAccount,
        disabled: disableAccount,
        status: disableAccount ? "deactivated" : "active",
        accountStatus: disableAccount ? "deactivated" : "active",
        deactivatedAt: disableAccount ? serverTimestamp() : deleteField(),
        reactivatedAt: disableAccount ? deleteField() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return {
      ok: true,
      action,
      userId,
      disabled: disableAccount,
    };
  } catch (err) {
    console.error("syncUserAccountAction error:", err);

    // If this is already an HttpsError, rethrow it so the client receives the intended code/message.
    if (err instanceof HttpsError) {
      throw err;
    }

    // For unexpected errors, wrap and return a clearer message instead of the opaque 'internal'.
    throw new HttpsError(
      "internal",
      err && err.message ? String(err.message) : "Internal server error",
    );
  }
});
