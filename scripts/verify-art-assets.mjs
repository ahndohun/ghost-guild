#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(projectRoot, "public");
const assetRoot = path.join(publicRoot, "assets");
const manifestPath = path.join(assetRoot, "art-manifest.json");

const errors = [];
const ids = new Set();
const pathOwners = new Map();
const activePaths = new Set();
const retiredPaths = new Set();

const manifest = await loadManifest();
if (manifest !== undefined) {
  await verifyManifest(manifest);
  await verifyAssetDirectory();
}

if (errors.length > 0) {
  console.error(`Art asset verification failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Art assets verified: ${activePaths.size} active PNGs, ${retiredPaths.size} retired PNGs, ${ids.size} unique manifest ids.`,
  );
}

async function loadManifest() {
  try {
    const source = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(source);
    if (!isRecord(parsed)) {
      errors.push("art-manifest.json must contain one JSON object");
      return undefined;
    }
    return parsed;
  } catch (error) {
    errors.push(`cannot read art-manifest.json: ${formatError(error)}`);
    return undefined;
  }
}

async function verifyManifest(value) {
  if (value.schemaVersion !== 1) {
    errors.push(`schemaVersion must be 1, received ${JSON.stringify(value.schemaVersion)}`);
  }

  const directions = Array.isArray(value.directionOrder) ? value.directionOrder : [];
  if (directions.length !== 8 || new Set(directions).size !== 8) {
    errors.push("directionOrder must contain eight unique direction ids");
  }

  const actors = entriesOf(value.actors, "actors");
  for (const [actorKey, actor] of actors) {
    const label = `actors.${actorKey}`;
    registerId(actor.id, label);
    await verifyConsumers(actor, label);

    const canvas = dimensionsOf(actor.canvas, `${label}.canvas`);
    const animations = entriesOf(actor.animations, `${label}.animations`);
    if (animations.length === 0) {
      errors.push(`${label} must declare at least one animation`);
      continue;
    }

    for (const [animationKey, animation] of animations) {
      const animationLabel = `${label}.animations.${animationKey}`;
      const frameCount = positiveInteger(animation.frameCount, `${animationLabel}.frameCount`);
      if (typeof animation.pathTemplate === "string") {
        if (!animation.pathTemplate.includes("{direction}")) {
          errors.push(`${animationLabel}.pathTemplate must include {direction}`);
          continue;
        }
        for (const direction of directions) {
          const assetPath = animation.pathTemplate.replaceAll("{direction}", direction);
          await verifyDeclaredPng(assetPath, canvas, `${animationLabel}.${direction}`, activePaths);
        }
      } else if (typeof animation.path === "string") {
        const expected = dimensionsOf(
          animation.dimensions ?? {
            width: canvas?.width * frameCount,
            height: canvas?.height * directions.length,
          },
          `${animationLabel}.dimensions`,
        );
        await verifyDeclaredPng(animation.path, expected, animationLabel, activePaths);
      } else {
        errors.push(`${animationLabel} must declare pathTemplate or path`);
      }
    }
  }

  const activeGroups = [
    [value.classPortraits, "classPortraits"],
    [value.skillIcons, "skillIcons"],
    [value.itemIllustrations, "itemIllustrations"],
    [value.perkIcons, "perkIcons"],
    [isRecord(value.environment) ? value.environment.tiles : undefined, "environment.tiles"],
    [isRecord(value.environment) ? value.environment.props : undefined, "environment.props"],
    [value.results, "results"],
    [value.ui, "ui"],
  ];

  for (const [group, groupLabel] of activeGroups) {
    for (const [entryKey, entry] of entriesOf(group, groupLabel)) {
      const label = `${groupLabel}.${entryKey}`;
      registerId(entry.id, label);
      await verifyConsumers(entry, label);
      await verifyDeclaredPng(entry.path, dimensionsOf(entry.dimensions, `${label}.dimensions`), label, activePaths);
    }
  }

  if (!Array.isArray(value.retired)) {
    errors.push("retired must be an array");
  } else {
    for (const [index, entry] of value.retired.entries()) {
      const label = `retired[${index}]`;
      if (!isRecord(entry)) {
        errors.push(`${label} must be an object`);
        continue;
      }
      registerId(entry.id, label);
      if (typeof entry.reason !== "string" || entry.reason.trim().length === 0) {
        errors.push(`${label} must explain why the asset is retired`);
      }
      await verifyDeclaredPng(entry.path, dimensionsOf(entry.dimensions, `${label}.dimensions`), label, retiredPaths);
    }
  }
}

async function verifyConsumers(entry, label) {
  if (!Array.isArray(entry.consumers) || entry.consumers.length === 0) {
    errors.push(`${label} has no runtime consumer`);
    return;
  }
  if (typeof entry.runtimeToken !== "string" || entry.runtimeToken.length === 0) {
    errors.push(`${label} has no runtimeToken`);
    return;
  }

  let tokenFound = false;
  for (const consumer of entry.consumers) {
    if (typeof consumer !== "string" || consumer.length === 0) {
      errors.push(`${label} contains an invalid consumer path`);
      continue;
    }
    const absolute = path.resolve(projectRoot, consumer);
    if (!isInside(projectRoot, absolute)) {
      errors.push(`${label} consumer escapes project root: ${consumer}`);
      continue;
    }
    try {
      const source = await readFile(absolute, "utf8");
      if (source.includes(entry.runtimeToken)) {
        tokenFound = true;
      }
    } catch (error) {
      errors.push(`${label} consumer is missing: ${consumer} (${formatError(error)})`);
    }
  }
  if (!tokenFound) {
    errors.push(`${label} runtimeToken is absent from all consumers: ${entry.runtimeToken}`);
  }
}

async function verifyDeclaredPng(assetPath, expectedDimensions, label, targetSet) {
  if (typeof assetPath !== "string" || !assetPath.startsWith("assets/") || !assetPath.endsWith(".png")) {
    errors.push(`${label} must declare a PNG path below assets/: ${JSON.stringify(assetPath)}`);
    return;
  }
  if (assetPath.includes("{") || assetPath.includes("}")) {
    errors.push(`${label} contains an unresolved path token: ${assetPath}`);
    return;
  }

  const owner = pathOwners.get(assetPath);
  if (owner !== undefined) {
    errors.push(`${assetPath} is declared more than once (${owner}, ${label})`);
    return;
  }
  pathOwners.set(assetPath, label);
  targetSet.add(assetPath);

  const absolute = path.resolve(publicRoot, assetPath);
  if (!isInside(assetRoot, absolute)) {
    errors.push(`${label} escapes public/assets: ${assetPath}`);
    return;
  }

  try {
    const actual = await readPngDimensions(absolute);
    if (
      expectedDimensions !== undefined &&
      (actual.width !== expectedDimensions.width || actual.height !== expectedDimensions.height)
    ) {
      errors.push(
        `${assetPath} is ${actual.width}x${actual.height}; expected ${expectedDimensions.width}x${expectedDimensions.height}`,
      );
    }
  } catch (error) {
    errors.push(`${label} cannot read ${assetPath}: ${formatError(error)}`);
  }
}

async function verifyAssetDirectory() {
  const files = await walkFiles(assetRoot);
  for (const absolute of files) {
    const relative = normalizePath(path.relative(publicRoot, absolute));
    if (relative === "assets/art-manifest.json" || relative.startsWith("assets/audio/")) {
      continue;
    }
    const extension = path.extname(relative).toLowerCase();
    if (extension !== ".png") {
      errors.push(`runtime visual must be PNG or explicitly excluded metadata/audio: ${relative}`);
      continue;
    }
    if (!activePaths.has(relative) && !retiredPaths.has(relative)) {
      errors.push(`unexplained PNG is absent from active and retired manifest entries: ${relative}`);
    }
  }

  for (const declared of [...activePaths, ...retiredPaths]) {
    if (!files.some((absolute) => normalizePath(path.relative(publicRoot, absolute)) === declared)) {
      errors.push(`manifest path is missing from public assets: ${declared}`);
    }
  }
}

async function readPngDimensions(filePath) {
  const data = await readFile(filePath);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (data.length < 24 || signature.some((byte, index) => data[index] !== byte)) {
    throw new Error("not a valid PNG signature/IHDR header");
  }
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

async function walkFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await walkFiles(absolute));
    } else if (entry.isFile()) {
      output.push(absolute);
    } else {
      const info = await stat(absolute);
      if (info.isFile()) {
        output.push(absolute);
      }
    }
  }
  return output;
}

function entriesOf(value, label) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return [];
  }
  return Object.entries(value).filter(([, entry]) => {
    if (!isRecord(entry)) {
      errors.push(`${label} contains a non-object entry`);
      return false;
    }
    return true;
  });
}

function dimensionsOf(value, label) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object with width and height`);
    return undefined;
  }
  const width = positiveInteger(value.width, `${label}.width`);
  const height = positiveInteger(value.height, `${label}.height`);
  return width === 0 || height === 0 ? undefined : { width, height };
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${label} must be a positive integer`);
    return 0;
  }
  return value;
}

function registerId(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} has no id`);
    return;
  }
  if (ids.has(value)) {
    errors.push(`duplicate manifest id ${value} at ${label}`);
    return;
  }
  ids.add(value);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
