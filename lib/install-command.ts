export const DEFAULT_TARGET_PROFILE = "web";

const targetProfilePattern = /^[A-Za-z0-9._-]+$/;
const installSpecPattern = /^[A-Za-z0-9@._/:#-]+$/;

export function isValidTargetProfile(profile: string): boolean {
  return profile.length > 0 && profile.length <= 80 && targetProfilePattern.test(profile);
}

export function buildOfficialPluginInstallCommand(
  installSpec: string,
  profile = DEFAULT_TARGET_PROFILE,
): string {
  if (!isValidTargetProfile(profile)) {
    throw new Error(`Invalid DSH profile name: ${profile}`);
  }
  if (
    installSpec.length === 0 ||
    installSpec.length > 500 ||
    installSpec.startsWith("-") ||
    !installSpecPattern.test(installSpec)
  ) {
    throw new Error(`Invalid install spec: ${installSpec}`);
  }
  return `npx -y @deepseek-ai/dsh plugin --profile ${profile} add ${installSpec}`;
}

export function pinInstallSpec(packageName: string, version: string): string {
  if (
    packageName.length === 0 ||
    packageName.length > 214 ||
    packageName.startsWith("-") ||
    !/^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/.test(packageName)
  ) {
    throw new Error(`Invalid package name: ${packageName}`);
  }
  if (
    version.length === 0 ||
    version.length > 80 ||
    !/^[A-Za-z0-9._+-]+$/.test(version)
  ) {
    throw new Error(`Invalid version: ${version}`);
  }
  return `${packageName}@${version}`;
}
