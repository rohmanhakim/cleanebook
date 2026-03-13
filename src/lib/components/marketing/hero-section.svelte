<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
</script>

<section class="py-16 sm:py-24 lg:py-32">
  <div class="container-narrow">
    <div class="flex flex-col items-center text-center">
      <Badge variant="secondary" class="mb-4">Free to try • No signup required</Badge>
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
        PDFs that actually read well
        <span class="text-brand-600">on your eReader</span>
      </h1>
      <p class="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-10">
        Stop struggling with garbled conversions. CleanEbook transforms publisher PDFs into clean,
        well-structured EPUB files optimized for Kindle, Kobo, and more.
      </p>
      <slot />
      <p class="text-sm text-muted-foreground">
        Free tier: 3 conversions/month • No credit card required
      </p>
    </div>
  </div>
</section>
