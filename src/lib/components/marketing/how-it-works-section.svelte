<script lang="ts">
	import * as Separator from '$lib/components/ui/separator';

	const steps = [
		{
			number: 1,
			title: 'Upload Your PDF',
			description: 'Drop your PDF and we\'ll analyze its structure automatically.'
		},
		{
			number: 2,
			title: 'Define Regions',
			description: 'Mark what\'s content, what\'s chrome, and what\'s special on a sample page.'
		},
		{
			number: 3,
			title: 'Download EPUB',
			description: 'Get a clean, well-structured EPUB ready for your eReader.'
		}
	];
</script>

<Separator.Root class="container-narrow" />

<section id="how-it-works" class="py-16 sm:py-24">
	<div class="container-narrow">
		<div class="text-center mb-12">
			<h2 class="text-3xl sm:text-4xl font-bold mb-4">
				How It Works
			</h2>
			<p class="text-lg text-muted-foreground max-w-2xl mx-auto">
				Three simple steps to clean EPUBs
			</p>
		</div>
		<div class="grid sm:grid-cols-3 gap-8">
			{#each steps as step}
				<div class="text-center">
					<div class="size-16 rounded-full bg-brand-600 flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
						{step.number}
					</div>
					<h3 class="text-lg font-semibold mb-2">{step.title}</h3>
					<p class="text-muted-foreground">{step.description}</p>
				</div>
			{/each}
		</div>
	</div>
</section>