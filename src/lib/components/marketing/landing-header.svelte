<script lang="ts">
	import * as Button from '$lib/components/ui/button';
	import * as Separator from '$lib/components/ui/separator';
	import * as Sheet from '$lib/components/ui/sheet';
	import { BookOpen, Menu } from '@lucide/svelte';

	let mobileMenuOpen = $state(false);
</script>

<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
	<div class="container-narrow flex h-16 items-center justify-between">
		<a href="/" class="flex items-center gap-2">
			<div class="flex size-8 items-center justify-center rounded-lg bg-brand-600">
				<BookOpen class="size-5 text-white" />
			</div>
			<span class="text-xl font-bold">CleanEbook</span>
		</a>
		
		<!-- Desktop Navigation -->
		<nav class="hidden sm:flex items-center gap-6">
			<a href="#features" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
			<a href="#how-it-works" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
			<a href="#pricing" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
		</nav>
		
		<div class="flex items-center gap-3">
			<a href="/login" class="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
				Sign In
			</a>
			<Button.Root href="/register" variant="default" size="sm">
				Get Started
			</Button.Root>
			
			<!-- Mobile Menu -->
			<Sheet.Root bind:open={mobileMenuOpen}>
				<Sheet.Trigger class="sm:hidden inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 w-8">
					<Menu class="size-5" />
				</Sheet.Trigger>
				<Sheet.Content side="right" class="w-80">
					<Sheet.Header>
						<Sheet.Title>CleanEbook</Sheet.Title>
						<Sheet.Description class="sr-only">Navigation menu</Sheet.Description>
					</Sheet.Header>
					<div class="flex flex-col gap-4 mt-6">
						<a href="#features" class="text-sm font-medium hover:text-brand-600 transition-colors" onclick={() => mobileMenuOpen = false}>Features</a>
						<a href="#how-it-works" class="text-sm font-medium hover:text-brand-600 transition-colors" onclick={() => mobileMenuOpen = false}>How It Works</a>
						<a href="#pricing" class="text-sm font-medium hover:text-brand-600 transition-colors" onclick={() => mobileMenuOpen = false}>Pricing</a>
						<Separator.Root class="my-2" />
						<a href="/login" class="text-sm font-medium hover:text-brand-600 transition-colors">Sign In</a>
						<Button.Root href="/register" class="w-full">
							Get Started
						</Button.Root>
					</div>
				</Sheet.Content>
			</Sheet.Root>
		</div>
	</div>
</header>