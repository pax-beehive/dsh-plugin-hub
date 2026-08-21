export default function PluginCardHeading({
  packageName,
  displayName,
  verified,
  claimed,
  claimedLabel,
  altHint,
}: {
  packageName?: string;
  displayName: string;
  verified?: boolean;
  claimed?: boolean;
  claimedLabel: string;
  altHint?: string | null;
}) {
  return (
    <>
      {packageName ? <code className="plugin-package-name">{packageName}</code> : null}
      <h3>
        {displayName}
        {altHint ? <span className="plugin-alt-hint">{altHint}</span> : null}
        {verified ? (
          <span className="verified-badge" title="Verified">
            {"\u2713"}
          </span>
        ) : null}
        {claimed ? <span className="claimed-badge">{claimedLabel}</span> : null}
      </h3>
    </>
  );
}
