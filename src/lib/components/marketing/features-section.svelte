<script lang="ts">
  import FeatureCard from './feature-card.svelte';
  import * as Separator from '$lib/components/ui/separator';

  const features = [
    {
      title: 'Smart Region Detection',
      description:
        'Automatically identifies and removes headers, footers, and page numbers that clutter your reading experience.',
      icon: 'check-circle',
    },
    {
      title: 'Figure & Code Handling',
      description:
        'Preserves images, diagrams, and code blocks in the right places—not as garbled text.',
      icon: 'image',
    },
    {
      title: 'Template System',
      description:
        "Define rules once for a publisher's format, reuse for all their books. Perfect for series.",
      icon: 'document',
    },
  ];
</script>

<Separator.Root class="container-narrow" />

<section id="features" class="py-16 sm:py-24">
  <div class="container-narrow">
    <div class="text-center mb-12">
      <h2 class="text-3xl sm:text-4xl font-bold mb-4">Why CleanEbook?</h2>
      <p class="text-lg text-muted-foreground max-w-2xl mx-auto">
        Generic converters fail because they can't distinguish content from chrome. We solve this
        with intelligent region detection.
      </p>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each features as feature}
        <FeatureCard title={feature.title} description={feature.description}>
          {#snippet icon()}
            {#if feature.icon === 'check-circle'}
              <svg
                class="size-6 text-brand-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            {:else if feature.icon === 'image'}
              <svg
                class="size-6 text-brand-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            {:else}
              <svg
                class="size-6 text-brand-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            {/if}
          {/snippet}
        </FeatureCard>
      {/each}
    </div>
  </div>
</section>
