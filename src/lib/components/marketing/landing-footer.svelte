<script lang="ts">
  import { BookOpen } from '@lucide/svelte';
</script>

<footer class="border-t py-12">
  <div class="container-narrow">
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <div class="size-6 rounded bg-brand-600 flex items-center justify-center">
          <BookOpen class="size-4 text-white" />
        </div>
        <span class="text-sm text-muted-foreground">© 2025 CleanEbook. All rights reserved.</span>
      </div>
      <nav class="flex items-center gap-6">
        <a href="#" class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >Privacy</a
        >
        <a href="#" class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >Terms</a
        >
        <a href="#" class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >Contact</a
        >
      </nav>
    </div>
  </div>
</footer>
