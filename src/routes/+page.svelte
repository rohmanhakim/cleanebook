<script lang="ts">
	// Landing page for CleanEbook
</script>

<svelte:head>
	<title>CleanEbook — Convert PDFs to Clean EPUBs</title>
	<meta name="description" content="Transform publisher PDFs into clean, well-structured EPUB files optimized for eReaders. No more garbled conversions." />
</svelte:head>

<div class="min-h-screen flex flex-col">
	<!-- Header -->
	<header class="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
		<div class="container-narrow flex items-center justify-between h-16">
			<a href="/" class="flex items-center gap-2">
				<div class="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
					<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
					</svg>
				</div>
				<span class="text-xl font-bold text-gray-900">CleanEbook</span>
			</a>
			<nav class="hidden sm:flex items-center gap-6">
				<a href="#features" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Features</a>
				<a href="#how-it-works" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">How It Works</a>
				<a href="#pricing" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
			</nav>
			<div class="flex items-center gap-3">
				<a href="/login" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Sign In</a>
				<a href="/register" class="btn-primary text-sm py-2 px-4">Get Started</a>
			</div>
		</div>
	</header>

	<main>
		<!-- Hero Section -->
		<section class="py-20 sm:py-32">
			<div class="container-narrow text-center">
				<h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight mb-6">
					PDFs that actually read well<br />
					<span class="text-brand-600">on your eReader</span>
				</h1>
				<p class="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
					Stop struggling with garbled conversions. CleanEbook transforms publisher PDFs into clean, well-structured EPUB files optimized for Kindle, Kobo, and more.
				</p>
				<div class="flex flex-col sm:flex-row items-center justify-center gap-4">
					<a href="/register" class="btn-primary">
						Start Converting Free
						<svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
						</svg>
					</a>
					<a href="#how-it-works" class="btn-secondary">
						See How It Works
					</a>
				</div>
				<p class="text-sm text-gray-500 mt-4">Free tier: 3 conversions/month • No credit card required</p>
			</div>
		</section>

		<!-- Features Section -->
		<section id="features" class="py-20 bg-gray-50">
			<div class="container-narrow">
				<h2 class="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">
					Why CleanEbook?
				</h2>
				<p class="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
					Generic converters fail because they can't distinguish content from chrome. We solve this with intelligent region detection.
				</p>
				<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
					<div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
						<div class="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center mb-4">
							<svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Smart Region Detection</h3>
						<p class="text-gray-600">Automatically identifies and removes headers, footers, and page numbers that clutter your reading experience.</p>
					</div>
					<div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
						<div class="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center mb-4">
							<svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
						</div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Figure & Code Handling</h3>
						<p class="text-gray-600">Preserves images, diagrams, and code blocks in the right places—not as garbled text.</p>
					</div>
					<div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
						<div class="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center mb-4">
							<svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
						</div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Template System</h3>
						<p class="text-gray-600">Define rules once for a publisher's format, reuse for all their books. Perfect for series.</p>
					</div>
				</div>
			</div>
		</section>

		<!-- How It Works Section -->
		<section id="how-it-works" class="py-20">
			<div class="container-narrow">
				<h2 class="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">
					How It Works
				</h2>
				<p class="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
					Three simple steps to clean EPUBs
				</p>
				<div class="grid sm:grid-cols-3 gap-8">
					<div class="text-center">
						<div class="w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
							1
						</div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Upload Your PDF</h3>
						<p class="text-gray-600">Drop your PDF and we'll analyze its structure automatically.</p>
					</div>
					<div class="text-center">
						<div class="w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
							2
						</div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Define Regions</h3>
						<p class="text-gray-600">Mark what's content, what's chrome, and what's special on a sample page.</p>
					</div>
					<div class="text-center">
						<div class="w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
							3
						</div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Download EPUB</h3>
						<p class="text-gray-600">Get a clean, well-structured EPUB ready for your eReader.</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Pricing Section -->
		<section id="pricing" class="py-20 bg-gray-50">
			<div class="container-narrow">
				<h2 class="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">
					Simple, Transparent Pricing
				</h2>
				<p class="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
					Start free, upgrade when you need more
				</p>
				<div class="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
					<div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Free</h3>
						<div class="text-3xl font-bold text-gray-900 mb-4">$0<span class="text-lg font-normal text-gray-500">/mo</span></div>
						<ul class="space-y-3 text-sm text-gray-600 mb-6">
							<li class="flex items-center gap-2">
								<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								3 conversions/month
							</li>
							<li class="flex items-center gap-2">
								<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Up to 100 pages
							</li>
							<li class="flex items-center gap-2">
								<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Client-side processing
							</li>
						</ul>
						<a href="/register" class="btn-secondary w-full text-center">Get Started</a>
					</div>
					<div class="bg-white rounded-xl p-6 shadow-lg border-2 border-brand-600 relative">
						<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Popular</div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Reader</h3>
						<div class="text-3xl font-bold text-gray-900 mb-4">$9<span class="text-lg font-normal text-gray-500">/mo</span></div>
						<ul class="space-y-3 text-sm text-gray-600 mb-6">
							<li class="flex items-center gap-2">
								<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								40 conversions/month
							</li>
							<li class="flex items-center gap-2">
								<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Up to 500 pages
							</li>
							<li class="flex items-center gap-2">
								<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Saved templates
							</li>
						</ul>
						<a href="/register" class="btn-primary w-full text-center">Get Started</a>
					</div>
					<div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Collector</h3>
						<div class="text-3xl font-bold text-gray-900 mb-4">$29<span class="text-lg font-normal text-gray-500">/mo</span></div>
						<ul class="space-y-3 text-sm text-gray-600 mb-6">
							<li class="flex items-center gap-2">
								<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Unlimited conversions
							</li>
							<li class="flex items-center gap-2">
								<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Unlimited pages
							</li>
							<li class="flex items-center gap-2">
								<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Batch processing
							</li>
						</ul>
						<a href="/register" class="btn-secondary w-full text-center">Get Started</a>
					</div>
				</div>
			</div>
		</section>
	</main>

	<!-- Footer -->
	<footer class="border-t border-gray-200 py-12">
		<div class="container-narrow">
			<div class="flex flex-col sm:flex-row items-center justify-between gap-4">
				<div class="flex items-center gap-2">
					<div class="w-6 h-6 bg-brand-600 rounded flex items-center justify-center">
						<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
						</svg>
					</div>
					<span class="text-sm text-gray-500">© 2025 CleanEbook. All rights reserved.</span>
				</div>
				<nav class="flex items-center gap-6">
					<!-- svelte-ignore a11y_invalid_attribute -->
					<a href="#" class="text-sm text-gray-500 hover:text-gray-700">Privacy</a>
					<!-- svelte-ignore a11y_invalid_attribute -->
					<a href="#" class="text-sm text-gray-500 hover:text-gray-700">Terms</a>
					<!-- svelte-ignore a11y_invalid_attribute -->
					<a href="#" class="text-sm text-gray-500 hover:text-gray-700">Contact</a>
				</nav>
			</div>
		</div>
	</footer>
</div>