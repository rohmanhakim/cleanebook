<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Button from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Check } from '@lucide/svelte';

	interface PricingCardProps {
		title: string;
		price: string;
		features: string[];
		popular?: boolean;
	}

	let { title, price, features, popular = false }: PricingCardProps = $props();
</script>

<Card.Root class="border-border/50 {popular ? 'border-brand-600 border-2 relative' : ''}">
	{#if popular}
		<Badge class="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white">
			Popular
		</Badge>
	{/if}
	<Card.Header>
		<Card.Title>{title}</Card.Title>
		<div class="text-3xl font-bold mt-2">
			${price}<span class="text-lg font-normal text-muted-foreground">/mo</span>
		</div>
	</Card.Header>
	<Card.Content class="space-y-3">
		{#each features as feature}
			<div class="flex items-center gap-2">
				<Check class="size-4 text-green-500" />
				<span class="text-sm">{feature}</span>
			</div>
		{/each}
	</Card.Content>
	<Card.Footer>
		<Button.Root variant={popular ? 'default' : 'outline'} class="w-full" href="/register">
			Get Started
		</Button.Root>
	</Card.Footer>
</Card.Root>