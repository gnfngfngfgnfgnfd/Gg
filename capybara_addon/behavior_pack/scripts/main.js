import { world, system } from "@minecraft/server";

// Track which players have the Morph Tool active
const morphedPlayers = new Map(); // playerId -> { mobType, ticksLeft }

const MORPH_DURATION_TICKS = 1200; // 60 seconds at 20tps

// ── Morph Tool: transform player on item use ─────────────────────────────────
world.afterEvents.itemUse.subscribe((ev) => {
  const item = ev.itemStack;
  const player = ev.source;

  if (item?.typeId !== "capybara:morph_tool") return;

  const playerId = player.id;

  if (morphedPlayers.has(playerId)) {
    demorph(player);
    player.sendMessage("§aMoreph Tool: Reverted to your normal form!");
    return;
  }

  // Find nearest capybara within 10 blocks
  const nearbyEntities = player.dimension.getEntities({
    location: player.location,
    maxDistance: 10,
    type: "capybara:capybara",
  });

  if (nearbyEntities.length === 0) {
    player.sendMessage("§cMorph Tool: No capybara nearby to copy!");
    return;
  }

  morphPlayer(player, "capybara:capybara");
  player.sendMessage(
    "§6Morph Tool: §eYou are now a Capybara! Right-click again to revert."
  );
});

// ── Morph: apply capybara-like tags + effects ────────────────────────────────
function morphPlayer(player, mobType) {
  const playerId = player.id;

  // Tags used by the attachable in the resource pack to swap player geometry
  player.addTag("morph:capybara");
  player.addTag("morphed");

  // Simulate capybara movement: slow on land, great in water
  player.addEffect("minecraft:slowness", MORPH_DURATION_TICKS, {
    amplifier: 1,
    showParticles: false,
  });
  player.addEffect("minecraft:dolphins_grace", MORPH_DURATION_TICKS, {
    amplifier: 1,
    showParticles: false,
  });
  player.addEffect("minecraft:water_breathing", MORPH_DURATION_TICKS, {
    amplifier: 0,
    showParticles: false,
  });
  player.addEffect("minecraft:jump_boost", MORPH_DURATION_TICKS, {
    amplifier: 0,
    showParticles: false,
  });

  morphedPlayers.set(playerId, {
    mobType,
    ticksLeft: MORPH_DURATION_TICKS,
  });
}

function demorph(player) {
  const playerId = player.id;
  player.removeTag("morph:capybara");
  player.removeTag("morphed");

  player.removeEffect("minecraft:slowness");
  player.removeEffect("minecraft:dolphins_grace");
  player.removeEffect("minecraft:water_breathing");
  player.removeEffect("minecraft:jump_boost");

  morphedPlayers.delete(playerId);
}

// ── Tick: count down morph duration ─────────────────────────────────────────
system.runInterval(() => {
  for (const [playerId, data] of morphedPlayers) {
    data.ticksLeft -= 20;
    if (data.ticksLeft <= 0) {
      try {
        const player = world.getAllPlayers().find((p) => p.id === playerId);
        if (player) {
          demorph(player);
          player.sendMessage("§7Morph Tool: Morph wore off.");
        } else {
          morphedPlayers.delete(playerId);
        }
      } catch {
        morphedPlayers.delete(playerId);
      }
    }
  }
}, 20);

// ── Orange head-feed interaction feedback ────────────────────────────────────
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const attacker = ev.damagingEntity;
  const target = ev.hitEntity;

  if (
    attacker?.typeId === "minecraft:player" &&
    target?.typeId === "capybara:capybara"
  ) {
    const equip = attacker.getComponent("minecraft:equippable");
    const heldItem = equip?.getEquipment("Mainhand");
    if (heldItem?.typeId === "capybara:orange") {
      const loc = {
        x: target.location.x,
        y: target.location.y + 0.9,
        z: target.location.z,
      };
      try {
        target.dimension.spawnParticle("minecraft:basic_flame_particle", loc);
      } catch {}
    }
  }
});

console.log("[Capybara Add-On] Scripts loaded!");
