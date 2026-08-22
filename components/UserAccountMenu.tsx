"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { HubLocale } from "@/lib/i18n";
import type { HubAccount } from "@/lib/user-account";
import UserAvatar from "./UserAvatar";

export default function UserAccountMenu({
  account,
  locale,
}: {
  account: HubAccount;
  locale: HubLocale;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const copy = locale === "en"
    ? { account: "Account", dashboard: "Dashboard", signOut: "Sign out" }
    : { account: "账户", dashboard: "控制台", signOut: "退出登录" };

  function closeMenu() {
    detailsRef.current?.removeAttribute("open");
  }

  useEffect(() => {
    function closeWhenOutside(event: globalThis.FocusEvent | PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !detailsRef.current?.contains(target)) {
        closeMenu();
      }
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      const target = event.target;
      if (
        event.key === "Escape" &&
        target instanceof Node &&
        detailsRef.current?.contains(target)
      ) {
        closeMenu();
        detailsRef.current.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("focusin", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => {
      document.removeEventListener("focusin", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeWhenOutside);
    };
  }, []);

  return (
    <details className="hub-account" ref={detailsRef}>
      <summary
        className="hub-account-trigger"
        aria-label={`${copy.account}: ${account.displayName}`}
      >
        <UserAvatar
          avatarUrl={account.avatarUrl}
          initials={account.initials}
        />
        <span className="hub-account-name" title={account.displayName}>
          {account.displayName}
        </span>
        <span className="hub-account-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="hub-account-menu">
        <div className="hub-account-identity">
          <strong>{account.displayName}</strong>
          {account.displayName !== account.email ? <span>{account.email}</span> : null}
        </div>
        <Link href="/dashboard">{copy.dashboard}</Link>
        <a href="/sign-out">{copy.signOut}</a>
      </div>
    </details>
  );
}
