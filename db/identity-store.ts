import type { GitHubClaimStore, VerifiedGitHubInstallation } from "@/lib/github-app";
import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";
import {
  githubInstallationRepositories,
  githubInstallations,
  hubUsers,
} from "./schema.ts";

export interface WorkosUserInput {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
}

export class D1IdentityStore implements GitHubClaimStore {
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.db = db;
  }

  async upsertWorkosUser(user: WorkosUserInput) {
    const displayName =
      user.name ??
      ([user.firstName, user.lastName].filter(Boolean).join(" ") || null);
    const rows = await this.db
      .insert(hubUsers)
      .values({
        id: crypto.randomUUID(),
        workosUserId: user.id,
        email: user.email.toLowerCase(),
        displayName,
        avatarUrl: user.profilePictureUrl,
      })
      .onConflictDoUpdate({
        target: hubUsers.workosUserId,
        set: {
          email: user.email.toLowerCase(),
          displayName,
          avatarUrl: user.profilePictureUrl,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .returning();
    return rows[0];
  }

  async saveInstallation(
    workosUserId: string,
    input: VerifiedGitHubInstallation,
  ): Promise<void> {
    const users = await this.db
      .select({ id: hubUsers.id })
      .from(hubUsers)
      .where(eq(hubUsers.workosUserId, workosUserId))
      .limit(1);
    const userId = users[0]?.id;
    if (!userId) throw new Error("workos_user_not_synced");

    await this.db
      .insert(githubInstallations)
      .values({
        id: String(input.id),
        userId,
        accountLogin: input.accountLogin,
        targetType: input.targetType,
        repositorySelection: input.repositorySelection,
        suspendedAt: input.suspendedAt,
      })
      .onConflictDoUpdate({
        target: githubInstallations.id,
        set: {
          userId,
          accountLogin: input.accountLogin,
          targetType: input.targetType,
          repositorySelection: input.repositorySelection,
          suspendedAt: input.suspendedAt,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    await this.db
      .delete(githubInstallationRepositories)
      .where(
        eq(githubInstallationRepositories.installationId, String(input.id)),
      );
    if (input.repositories.length > 0) {
      await this.db.insert(githubInstallationRepositories).values(
        input.repositories.map((repository) => ({
          id: crypto.randomUUID(),
          installationId: String(input.id),
          repositoryId: String(repository.id),
          fullName: repository.fullName,
          isPrivate: repository.isPrivate,
          defaultBranch: repository.defaultBranch,
        })),
      );
    }
  }

  async listGitHubRepositories(workosUserId: string) {
    return this.db
      .select({
        installationId: githubInstallations.id,
        accountLogin: githubInstallations.accountLogin,
        repositoryId: githubInstallationRepositories.repositoryId,
        fullName: githubInstallationRepositories.fullName,
        isPrivate: githubInstallationRepositories.isPrivate,
        defaultBranch: githubInstallationRepositories.defaultBranch,
      })
      .from(githubInstallationRepositories)
      .innerJoin(
        githubInstallations,
        eq(githubInstallationRepositories.installationId, githubInstallations.id),
      )
      .innerJoin(hubUsers, eq(githubInstallations.userId, hubUsers.id))
      .where(eq(hubUsers.workosUserId, workosUserId));
  }

  async findGitHubRepository(workosUserId: string, fullName: string) {
    const rows = await this.db
      .select({
        installationId: githubInstallations.id,
        accountLogin: githubInstallations.accountLogin,
        repositoryId: githubInstallationRepositories.repositoryId,
        fullName: githubInstallationRepositories.fullName,
        isPrivate: githubInstallationRepositories.isPrivate,
        defaultBranch: githubInstallationRepositories.defaultBranch,
      })
      .from(githubInstallationRepositories)
      .innerJoin(
        githubInstallations,
        eq(githubInstallationRepositories.installationId, githubInstallations.id),
      )
      .innerJoin(hubUsers, eq(githubInstallations.userId, hubUsers.id))
      .where(
        and(
          eq(hubUsers.workosUserId, workosUserId),
          eq(githubInstallationRepositories.fullName, fullName),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
}
