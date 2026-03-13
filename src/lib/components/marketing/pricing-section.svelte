<script lang="ts">
  import PricingCard from './pricing-card.svelte';
  import * as Separator from '$lib/components/ui/separator';

  const plans = [
    {
      title: 'Free',
      price: '0',
      features: ['3 conversions/month', 'Up to 100 pages', 'Client-side processing'],
      popular: false,
    },
    {
      title: 'Reader',
      price: '9',
      features: ['40 conversions/month', 'Up to 500 pages', 'Saved templates'],
      popular: true,
    },
    {
      title: 'Collector',
      price: '29',
      features: ['Unlimited conversions', 'Unlimited pages', 'Batch processing'],
      popular: false,
    },
  ];
</script>

<Separator.Root class="container-narrow" />

<section id="pricing" class="py-16 sm:py-24 bg-muted/30">
  <div class="container-narrow">
    <div class="text-center mb-12">
      <h2 class="text-3xl sm:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
      <p class="text-lg text-muted-foreground max-w-2xl mx-auto">
        Start free, upgrade when you need more
      </p>
    </div>
    <div class="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
      {#each plans as plan (plan.title)}
        <PricingCard
          title={plan.title}
          price={plan.price}
          features={plan.features}
          popular={plan.popular}
        />
      {/each}
    </div>
  </div>
</section>
