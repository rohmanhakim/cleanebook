<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '$lib/components/ui/card';

	interface FeatureCardProps {
		title: string;
		description: string;
		icon: Snippet;
	}

	let { title, description, icon }: FeatureCardProps = $props();
</script>

<Card.Root class="border-border/50">
	<Card.Header>
		<div class="size-12 rounded-lg bg-brand-100 flex items-center justify-center mb-4">
			{@render icon()}
		</div>
		<Card.Title>{title}</Card.Title>
		<Card.Description>{description}</Card.Description>
	</Card.Header>
</Card.Root>