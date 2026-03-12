import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PricingCard from '$lib/components/marketing/pricing-card.svelte';

describe('PricingCard', () => {
	it('should render with title, price, and features', () => {
		const { getByText } = render(PricingCard, {
			title: 'Test Plan',
			price: '99',
			features: ['Feature 1', 'Feature 2', 'Feature 3'],
			popular: false
		});

		expect(getByText('Test Plan')).toBeTruthy();
		expect(getByText('$99')).toBeTruthy();
		expect(getByText('Feature 1')).toBeTruthy();
		expect(getByText('Feature 2')).toBeTruthy();
		expect(getByText('Feature 3')).toBeTruthy();
	});

	it('should show Popular badge when popular is true', () => {
		const { getByText, container } = render(PricingCard, {
			title: 'Popular Plan',
			price: '49',
			features: ['Feature A'],
			popular: true
		});

		expect(getByText('Popular')).toBeTruthy();
		
		// Check border styling for popular card
		const card = container.querySelector('.border-brand-600');
		expect(card).toBeTruthy();
	});

	it('should not show Popular badge when popular is false', () => {
		const { queryByText, container } = render(PricingCard, {
			title: 'Basic Plan',
			price: '0',
			features: ['Feature X'],
			popular: false
		});

		expect(queryByText('Popular')).toBeNull();
		
		// Check that popular border styling is not applied
		const card = container.querySelector('.border-brand-600');
		expect(card).toBeNull();
	});
});