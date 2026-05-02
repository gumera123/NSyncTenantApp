import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
} from "firebase/firestore";
import { auth, db } from "../../../firebaseConfig";
import { isAccountDeactivated } from "../../utils/accountStatus";

const ADMIN_EMAIL = process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL || "";

export function toMillis(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  return 0;
}

export function formatDate(value) {
  const millis = toMillis(value);

  if (!millis) {
    return "Not available";
  }

  return new Date(millis).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value) {
  const millis = toMillis(value);

  if (!millis) {
    return "Recently";
  }

  return new Date(millis).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSuperAdmin(user, userRecord) {
  if (isAccountDeactivated(userRecord)) {
    return false;
  }

  const role = String(userRecord?.role || "").toLowerCase();
  const email = String(user?.email || "").toLowerCase();
  const configuredAdminEmail = ADMIN_EMAIL.toLowerCase();

  return Boolean(
    userRecord?.isSuperAdmin ||
    role === "super admin" ||
    role === "superadmin" ||
    (configuredAdminEmail && email === configuredAdminEmail),
  );
}

export async function loginSuperAdmin(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password,
  );
  const users = await fetchUsers();
  const userRecord = users.find((item) => item.id === credential.user.uid);

  if (!isSuperAdmin(credential.user, userRecord)) {
    await signOut(auth);
    throw new Error(
      "This account is not allowed to access the Super Admin Dashboard.",
    );
  }

  return credential.user;
}

export async function verifySuperAdminUser(user) {
  if (!user) {
    return false;
  }

  const users = await fetchUsers();
  const userRecord = users.find((item) => item.id === user.uid);

  return isSuperAdmin(user, userRecord);
}

export async function logoutSuperAdmin() {
  await signOut(auth);
}

export async function fetchUsers() {
  const snapshot = await getDocs(collection(db, "users"));

  return (
    snapshot.docs
      .map((userDoc) => ({
        id: userDoc.id,
        ...userDoc.data(),
      }))
      // Exclude soft-deleted users (status === 'deleted') so they don't appear in the UI
      .filter((u) => String(u.status || "").toLowerCase() !== "deleted")
      .sort(
        (left, right) => toMillis(right.createdAt) - toMillis(left.createdAt),
      )
  );
}

export async function fetchBoards() {
  const snapshot = await getDocs(collection(db, "boards"));

  return snapshot.docs.map((boardDoc) => ({
    id: boardDoc.id,
    ...boardDoc.data(),
  }));
}

export async function fetchTasks() {
  const snapshot = await getDocs(collection(db, "tasks"));

  return snapshot.docs.map((taskDoc) => ({
    id: taskDoc.id,
    ...taskDoc.data(),
  }));
}

async function fetchNotifications() {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "notifications"),
        orderBy("createdAt", "desc"),
        limit(20),
      ),
    );

    return snapshot.docs.map((notificationDoc) => ({
      id: notificationDoc.id,
      ...notificationDoc.data(),
    }));
  } catch (_error) {
    return [];
  }
}

export function buildWorkspaceList(users, boards, tasks) {
  const workspacesById = new Map();

  users.forEach((user) => {
    const organizationId =
      user.homeOrganizationId || user.organizationId || user.uid || user.id;
    const workspaceName =
      user.homeOrganizationName ||
      user.organizationName ||
      `${user.name || "User"} Workspace`;

    if (!workspacesById.has(organizationId)) {
      workspacesById.set(organizationId, {
        id: organizationId,
        name: workspaceName,
        ownerName: user.name || user.email || "Unknown owner",
        ownerEmail: user.email || "",
        members: 0,
        boards: 0,
        tasks: 0,
      });
    }
  });

  users.forEach((user) => {
    const memberships = Array.isArray(user.workspaceMemberships)
      ? user.workspaceMemberships
      : [];
    const currentOrganizationId = user.organizationId || user.uid || user.id;
    const ids = new Set([
      currentOrganizationId,
      ...memberships.map((item) => item.organizationId).filter(Boolean),
    ]);

    ids.forEach((organizationId) => {
      if (workspacesById.has(organizationId)) {
        workspacesById.get(organizationId).members += 1;
      }
    });
  });

  boards.forEach((board) => {
    const workspace = workspacesById.get(board.organizationId || board.userId);
    if (workspace) {
      workspace.boards += 1;
    }
  });

  tasks.forEach((task) => {
    const workspace = workspacesById.get(task.organizationId || task.userId);
    if (workspace) {
      workspace.tasks += 1;
    }
  });

  return Array.from(workspacesById.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function buildActivityList(users, boards, tasks, notifications) {
  const items = [
    ...users.map((user) => ({
      id: `user-${user.id}`,
      type: "User registration",
      title: user.name || user.email || "New user",
      detail: user.email || "Registered an account",
      createdAt: user.createdAt,
    })),
    ...boards.map((board) => ({
      id: `board-${board.id}`,
      type: "Workspace board",
      title: board.title || "New board",
      detail: board.description || "Board created",
      createdAt: board.createdAt,
    })),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      type: "Task creation",
      title: task.title || "New task",
      detail: task.boardTitle
        ? `Board: ${task.boardTitle}`
        : task.status || "Task created",
      createdAt: task.createdAt,
    })),
    ...notifications.map((notification) => ({
      id: `notification-${notification.id}`,
      type: notification.type || "Notification",
      title: notification.title || "Activity update",
      detail: notification.message || "",
      createdAt: notification.createdAt,
    })),
  ];

  return items
    .sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt))
    .slice(0, 30);
}

export async function fetchAdminDashboardData() {
  const [users, boards, tasks, notifications] = await Promise.all([
    fetchUsers(),
    fetchBoards(),
    fetchTasks(),
    fetchNotifications(),
  ]);

  // Filter tasks to only include those belonging to active users
  // (tasks from deleted users should not count in totals)
  const activeUserIds = new Set(users.map((u) => u.id));
  const filteredTasks = tasks.filter((task) => {
    const taskOwnerId = task.userId || task.organizationId || task.createdBy;
    return taskOwnerId && activeUserIds.has(taskOwnerId);
  });

  const workspaces = buildWorkspaceList(users, boards, filteredTasks);
  const activity = buildActivityList(
    users,
    boards,
    filteredTasks,
    notifications,
  );

  return {
    users,
    boards,
    tasks: filteredTasks,
    workspaces,
    activity,
    totals: {
      users: users.length,
      workspaces: workspaces.length,
      tasks: filteredTasks.length,
    },
  };
}

/**
 * Delete an activity by its composite ID
 * Activity IDs are composite: "type-originalId" (e.g., "user-123", "task-456")
 */
export async function deleteActivity(activityId) {
  try {
    const [type, id] = activityId.split("-");

    if (!type || !id) {
      throw new Error("Invalid activity ID format");
    }

    let collectionName;
    switch (type) {
      case "user":
        collectionName = "users";
        break;
      case "board":
        collectionName = "boards";
        break;
      case "task":
        collectionName = "tasks";
        break;
      case "notification":
        collectionName = "notifications";
        break;
      default:
        throw new Error(`Unknown activity type: ${type}`);
    }

    await deleteDoc(doc(db, collectionName, id));
    return { success: true };
  } catch (error) {
    console.error("Error deleting activity:", error);
    throw error;
  }
}
