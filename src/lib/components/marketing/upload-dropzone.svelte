<script lang="ts">
	import { Upload } from '@lucide/svelte';
</script>

<div class="w-full max-w-xl mb-8">
	<div class="border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center bg-muted/30 hover:bg-muted/50 hover:border-brand-500/50 transition-colors cursor-pointer">
		<div class="flex flex-col items-center gap-4">
			<div class="size-16 rounded-full bg-brand-100 flex items-center justify-center">
				<Upload class="size-8 text-brand-600" />
			</div>
			<div>
				<p class="text-lg font-medium mb-1">Drop your PDF here</p>
				<p class="text-sm text-muted-foreground">or click to browse</p>
			</div>
			<p class="text-xs text-muted-foreground">
				Max 100 pages • Free • No signup required
			</p>
		</div>
	</div>
</div>