import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import FeatureCard from '$lib/components/marketing/feature-card.svelte';

describe('FeatureCard', () => {
  it('should render with title and description', () => {
    const { getByText } = render(FeatureCard, {
      title: 'Test Feature',
      description: 'This is a test feature description',
      icon: (() => {}) as any,
    });

    expect(getByText('Test Feature')).toBeTruthy();
    expect(getByText('This is a test feature description')).toBeTruthy();
  });

  it('should render the icon in the designated area', () => {
    const { container } = render(FeatureCard, {
      title: 'Feature with Icon',
      description: 'Description here',
      icon: (() => {}) as any,
    });

    // Check that the icon container exists with the correct styling
    const iconContainer = container.querySelector('.bg-brand-100');
    expect(iconContainer).toBeTruthy();
    expect(iconContainer?.classList.contains('rounded-lg')).toBe(true);
  });
});
