<template>
  <component
    :is="iconComponent"
    :size="computedSize"
    :fill="computedFill"
    :theme="theme"
    :stroke-width="strokeWidth"
    :class="className"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { getIconFromEmoji, getIconColor, getIconSize, type IconSize } from '../modules/ui/iconMapping';

interface Props {
  // Can accept either emoji or direct icon name
  emoji?: string;
  name?: string;
  size?: IconSize | number;
  fill?: string;
  theme?: 'outline' | 'filled' | 'two-tone' | 'multi-color';
  strokeWidth?: number;
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  theme: 'outline',
  strokeWidth: 2,
});

// Compute the actual icon name
const iconName = computed(() => {
  if (props.name) return props.name;
  if (props.emoji) return getIconFromEmoji(props.emoji);
  return 'help'; // fallback icon
});

// Compute size
const computedSize = computed(() => getIconSize(props.size));

// Compute fill color
const computedFill = computed(() => {
  if (props.fill) return props.fill;
  if (props.emoji) return getIconColor(props.emoji);
  return 'currentColor';
});

// Common alias mapping to improve DX (short names -> IconPark component names)
const ICON_ALIAS: Record<string, string> = {
  'add': 'Plus',
  'delete': 'Delete',
  'refresh-one': 'RefreshOne',
  'refresh': 'Refresh',
  'computer': 'Computer',
  'laptop-computer': 'LaptopComputer',
  'lightbulb': 'Tips',
  'close': 'Close',
  'help': 'Help',
};

// Dynamically import the icon component with graceful fallbacks
const iconComponent = computed(() => {
  const requested = (iconName.value || '').trim().toLowerCase();
  const pascalFromKebab = requested
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  const primary = ICON_ALIAS[requested] || pascalFromKebab || 'Help';

  // Candidate names to try in order
  const candidates: string[] = [primary];
  if (requested === 'computer') candidates.push('LaptopComputer');
  if (requested === 'lightbulb') candidates.push('Lightbulb', 'Tips');
  if (requested === 'add') candidates.push('AddOne', 'Plus');
  if (requested === 'delete') candidates.push('DeleteOne', 'Delete');
  if (requested === 'refresh-one' || requested === 'refresh') candidates.push('RefreshOne', 'Refresh');

  const unique = Array.from(new Set(candidates));

  return defineAsyncComponent(async () => {
    for (const name of unique) {
      try {
        const mod = await import(`@icon-park/vue-next/es/icons/${name}`);
        return mod;
      } catch (e) {
        // try next candidate
      }
    }
    console.warn(`Icon "${iconName.value}" not found, using fallback`);
    return import('@icon-park/vue-next/es/icons/Help');
  });
});
</script>

<style scoped>
/* Ensure icons align properly */
:deep(svg) {
  vertical-align: middle;
  display: inline-block;
}
</style>
