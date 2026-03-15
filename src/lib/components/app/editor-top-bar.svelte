<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  interface Props {
    filename: string;
  }

  let { filename }: Props = $props();
</script>

<header class="fixed top-0 left-0 right-0 h-14 bg-background border-b z-50">
  <div class="h-full px-4 flex items-center justify-between">
    <!-- Logo -->
    <a href="/" class="font-semibold text-lg hover:opacity-80 transition-opacity"> CleanEbook </a>

    <!-- Filename (centered) -->
    <div class="absolute left-1/2 -translate-x-1/2 max-w-[40%]">
      <span class="text-sm text-muted-foreground truncate block text-center">
        {filename}
      </span>
    </div>

    <!-- Sign In placeholder -->
    <Button variant="outline" size="sm">Sign In</Button>
  </div>
</header>
