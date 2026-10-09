import { expect,test } from 'vitest';
import { render } from '@testing-library/react';
import { PassagePreview } from './PassagePreview';

test('Formula quotes render both delimiter styles and mixed text without changing source, including a long compact equation',()=>{
 const source='An inline \\(x_1+y_2\\) and display\n\n\\[\\frac{a}{b}='+('x+'.repeat(80))+'z\\]';const view=render(<PassagePreview text={source} compact/>);expect(view.container.querySelectorAll('.katex')).toHaveLength(2);expect(view.container.querySelectorAll('.katex-error')).toHaveLength(0);expect(source.endsWith('z\\]')).toBe(true);expect(view.container.querySelector('.compact')).not.toBeNull();
 view.rerender(<PassagePreview text={'$$\n\\sum_{i=1}^{n}x_i\n$$'}/>);expect(view.container.querySelector('.katex-display')).not.toBeNull();
});

test('Literal code and incomplete selections remain readable and previews do not fetch images or offer nested links',()=>{
 const view=render(<PassagePreview text={'`\\(literal\\)` and an incomplete \\(x_1\n\n![alt](https://example.com/image.png) [link](https://example.com)'}/>);expect(view.container.querySelectorAll('.katex')).toHaveLength(0);expect(view.container.querySelector('code')?.textContent).toBe('\\(literal\\)');expect(view.container.textContent).toContain('(x_1');expect(view.container.querySelectorAll('img,a')).toHaveLength(0);
});
