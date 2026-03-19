---
name: wcag-audit-patterns
description: Conduct WCAG 2.2 accessibility audits with automated testing, manual verification, and remediation guidance. Use when auditing websites for accessibility, fixing WCAG violations, or implementing accessible design patterns.
---

# WCAG Audit Patterns

Comprehensive guide to auditing web content against WCAG 2.2 guidelines with actionable remediation strategies.

## When to Use This Skill

- Conducting accessibility audits
- Fixing WCAG violations
- Implementing accessible components
- Preparing for accessibility lawsuits
- Meeting ADA/Section 508 requirements
- Achieving VPAT compliance

## Core Concepts

### 1. WCAG Conformance Levels

| Level | Description | Required For |
| ------- | ---------------------- | ----------------- |
| **A** | Minimum accessibility | Legal baseline |
| **AA** | Standard conformance | Most regulations |
| **AAA** | Enhanced accessibility | Specialized needs |

### 2. POUR Principles

```
Perceivable:  Can users perceive the content?
Operable:     Can users operate the interface?
Understandable: Can users understand the content?
Robust:       Does it work with assistive tech?
```

### 3. Common Violations by Impact

```
Critical (Blockers):
├── Missing alt text for functional images
├── No keyboard access to interactive elements
├── Missing form labels
└── Auto-playing media without controls

Serious:
├── Insufficient color contrast
├── Missing skip links
├── Inaccessible custom widgets
└── Missing page titles

Moderate:
├── Missing language attribute
├── Unclear link text
├── Missing landmarks
└── Improper heading hierarchy
```

## Audit Checklist

### Perceivable (Principle 1)

#### 1.1.1 Non-text Content (Level A)

- [ ] All images have alt text
- [ ] Decorative images have alt=""
- [ ] Complex images have long descriptions
- [ ] Icons with meaning have accessible names
- [ ] CAPTCHAs have alternatives

```html
<!-- Good -->
<img src="chart.png" alt="Sales increased 25% from Q1 to Q2" />
<img src="decorative-line.png" alt="" />

<!-- Bad -->
<img src="chart.png" />
<img src="decorative-line.png" alt="decorative line" />
```

#### 1.3.1 Info and Relationships (Level A)

- [ ] Headings use proper tags (h1-h6)
- [ ] Lists use ul/ol/dl
- [ ] Tables have headers
- [ ] Form inputs have labels
- [ ] ARIA landmarks present

```html
<!-- Heading hierarchy -->
<h1>Page Title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
  <h2>Another Section</h2>

<!-- Table headers -->
<table>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Price</th>
    </tr>
  </thead>
</table>
```

#### 1.3.2 Meaningful Sequence (Level A)

- [ ] Reading order is logical
- [ ] CSS positioning doesn't break order
- [ ] Focus order matches visual order

#### 1.4.1 Use of Color (Level A)

- [ ] Color is not only means of conveying info
- [ ] Links distinguishable without color
- [ ] Error states not color-only

#### 1.4.3 Contrast (Minimum) (Level AA)

- [ ] Text: 4.5:1 contrast ratio
- [ ] Large text (18pt+): 3:1 ratio
- [ ] UI components: 3:1 ratio

#### 1.4.4 Resize Text (Level AA)

- [ ] Text resizes to 200% without loss
- [ ] No horizontal scrolling at 320px
- [ ] Content reflows properly

#### 1.4.11 Non-text Contrast (Level AA)

- [ ] UI components have 3:1 contrast
- [ ] Focus indicators visible
- [ ] Graphical objects distinguishable

### Operable (Principle 2)

#### 2.1.1 Keyboard (Level A)

- [ ] All functionality keyboard accessible
- [ ] No keyboard traps
- [ ] Tab order is logical
- [ ] Custom widgets are keyboard operable

#### 2.2.2 Pause, Stop, Hide (Level A)

- [ ] Moving content can be paused
- [ ] Auto-updating content can be paused
- [ ] Animations respect prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

#### 2.4.1 Bypass Blocks (Level A)

- [ ] Skip to main content link present
- [ ] Landmark regions defined
- [ ] Proper heading structure

```html
<a href="#main" class="skip-link">Skip to main content</a>
<main id="main">...</main>
```

#### 2.4.2 Page Titled (Level A)

- [ ] Unique, descriptive page titles
- [ ] Title reflects page content

#### 2.4.4 Link Purpose (In Context) (Level A)

- [ ] Links make sense out of context
- [ ] No "click here" or "read more" alone

#### 2.4.7 Focus Visible (Level AA)

- [ ] Focus indicator visible on all elements
- [ ] Custom focus styles meet contrast

```css
:focus {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}
```

### Understandable (Principle 3)

#### 3.1.1 Language of Page (Level A)

- [ ] HTML lang attribute set
- [ ] Language correct for content

#### 3.3.1 Error Identification (Level A)

- [ ] Errors clearly identified
- [ ] Error message describes problem
- [ ] Error linked to field

```html
<input aria-describedby="email-error" aria-invalid="true" />
<span id="email-error" role="alert">Please enter valid email</span>
```

#### 3.3.2 Labels or Instructions (Level A)

- [ ] All inputs have visible labels
- [ ] Required fields indicated
- [ ] Format hints provided

### Robust (Principle 4)

#### 4.1.2 Name, Role, Value (Level A)

- [ ] Custom widgets have accessible names
- [ ] ARIA roles correct
- [ ] State changes announced

#### 4.1.3 Status Messages (Level AA)

- [ ] Status updates announced
- [ ] Live regions used correctly

```html
<div role="status" aria-live="polite">3 items added to cart</div>
<div role="alert" aria-live="assertive">Error: Form submission failed</div>
```

## Remediation Patterns

### Fix: Missing Form Labels

```html
<!-- Before -->
<input type="email" placeholder="Email" />

<!-- After: Visible label -->
<label for="email">Email address</label>
<input id="email" type="email" />

<!-- After: aria-label -->
<input type="email" aria-label="Email address" />
```

### Fix: Keyboard Navigation

```javascript
// Make custom element keyboard accessible
element.setAttribute("tabindex", "0");
element.setAttribute("role", "button");
element.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    element.click();
  }
});
```

### Fix: Focus Styles

```css
:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}
```

## Automated Testing

```javascript
// Playwright + axe-core
import AxeBuilder from '@axe-core/playwright';

test('should have no accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toHaveLength(0);
});
```

## Best Practices

- **Start early** - Accessibility from design phase
- **Use semantic HTML** - Reduces ARIA needs (native HTML first)
- **Test with real users** - Disabled users provide best feedback
- **Automate what you can** - 30-50% of issues detectable
- **Don't hide focus outlines** - Keyboard users need them
- **Don't disable zoom** - Users need to resize
- **Don't use color alone** - Multiple indicators needed
