<script lang="ts">
  import {
    LandingHeader,
    HeroSection,
    UploadDropzone,
    FeaturesSection,
    HowItWorksSection,
    PricingSection,
    LandingFooter,
  } from '$lib/components/marketing';
</script>

<svelte:head>
  <title>CleanEbook — Convert PDFs to Clean EPUBs</title>
  <meta
    name="description"
    content="Transform publisher PDFs into clean, well-structured EPUB files optimized for eReaders. No more garbled conversions."
  />
</svelte:head>

<div class="min-h-screen flex flex-col">
  <LandingHeader />

  <main>
    <HeroSection>
      <UploadDropzone />
    </HeroSection>

    <FeaturesSection />
    <HowItWorksSection />
    <PricingSection />
  </main>

  <LandingFooter />
</div>
