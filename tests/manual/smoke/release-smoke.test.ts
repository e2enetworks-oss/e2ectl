import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { runCommand } from '../../helpers/process.js';
import { readSmokeEnv, type SmokeEnv } from '../helpers/smoke-env.js';
import { createSmokeManifest } from '../helpers/smoke-manifest.js';
import {
  buildSecurityGroupRules,
  createNodeStep,
  runAddonReservedIpSteps,
  runNodeDeleteSteps,
  runNodeLifecycleActionSteps,
  runSecurityGroupSteps,
  runSshKeyCreateAndAttachSteps,
  runSshKeyDeleteStep,
  runVolumeSteps,
  runVpcSteps,
  type SmokeStepContext
} from '../helpers/smoke-steps.js';

let smokeEnv: SmokeEnv;

const MANUAL_SMOKE_TEST_TIMEOUT_MS = 30 * 60 * 1000;
const MANUAL_SMOKE_CLEANUP_TIMEOUT_MS = 10 * 60 * 1000;

describe('manual release smoke workflow', () => {
  beforeAll(async () => {
    smokeEnv = readSmokeEnv();

    await access(path.resolve(process.cwd(), 'dist', 'app', 'index.js'));
  });

  it(
    'exercises destructive release flows through the built CLI',
    { timeout: MANUAL_SMOKE_TEST_TIMEOUT_MS },
    async () => {
      const runPrefix = `${smokeEnv.prefix}-${Date.now().toString(36)}`;
      const context = await prepareSmokeContext(runPrefix);
      let cleanupError: Error | undefined;
      let workflowError: unknown;

      try {
        const { nodeId } = await createNodeStep(context, {
          nodeName: `${runPrefix}-node`
        });

        await runSecurityGroupSteps(context, {
          nodeId,
          rulesFilePath: context.rulesFilePath,
          securityGroupName: `${runPrefix}-sg`,
          updatedSecurityGroupName: `${runPrefix}-sg-updated`
        });
        await runAddonReservedIpSteps(context, {
          nodeId
        });
        await runVolumeSteps(context, {
          nodeId,
          volumeName: `${runPrefix}-volume`
        });
        await runVpcSteps(context, {
          nodeId,
          vpcName: `${runPrefix}-vpc`
        });

        const { sshKeyId } = await runSshKeyCreateAndAttachSteps(context, {
          nodeId,
          sshKeyLabel: `${runPrefix}-ssh`
        });
        await runNodeLifecycleActionSteps(context, {
          nodeId,
          saveImageName: `${runPrefix}-image`
        });
        await runNodeDeleteSteps(context, {
          nodeId
        });
        await runSshKeyDeleteStep(context, {
          sshKeyId
        });
      } catch (error: unknown) {
        workflowError = error;
        console.error(`Manual smoke manifest: ${context.manifestPath}`);
      } finally {
        const cleanupResult = await runCommand(
          process.execPath,
          [
            path.resolve(process.cwd(), 'scripts', 'manual-smoke-cleanup.mjs'),
            '--manifest',
            context.manifestPath
          ],
          {
            env: smokeEnv.cliEnv,
            timeoutMs: MANUAL_SMOKE_CLEANUP_TIMEOUT_MS
          }
        );

        if (cleanupResult.exitCode !== 0) {
          console.error(`Manual smoke manifest: ${context.manifestPath}`);
          console.error(cleanupResult.stdout);
          console.error(cleanupResult.stderr);

          if (workflowError === undefined) {
            cleanupError = new Error(
              `Manual smoke cleanup failed for manifest ${context.manifestPath}.`
            );
          }
        }
      }

      if (workflowError !== undefined) {
        throw toError(workflowError);
      }

      if (cleanupError !== undefined) {
        throw cleanupError;
      }
    }
  );
});

async function prepareSmokeContext(
  runPrefix: string
): Promise<SmokeStepContext & { rulesFilePath: string }> {
  const rulesFilePath = path.resolve(
    process.cwd(),
    '.tmp',
    `${runPrefix}-security-group-rules.json`
  );

  await mkdir(path.dirname(rulesFilePath), {
    recursive: true
  });
  await writeFile(
    rulesFilePath,
    `${JSON.stringify(buildSecurityGroupRules(), null, 2)}\n`,
    'utf8'
  );

  const { path: manifestPath } = await createSmokeManifest({
    prefix: runPrefix,
    ...(smokeEnv.manifestPath === undefined
      ? {}
      : {
          manifestPath: smokeEnv.manifestPath
        }),
    tempRulesFilePath: rulesFilePath
  });

  return {
    manifestPath,
    rulesFilePath,
    smokeEnv
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
