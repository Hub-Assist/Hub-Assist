# Email Templates Authoring Guide

Hub-Assist uses [Handlebars](https://handlebarsjs.com/) via `@nestjs-modules/mailer` to render emails.

## File Structure

- `templates/layouts/base.hbs`: The master layout wrapper. Contains the `<html>` shell, inline styling, Hub-Assist header, and footer.
- `templates/*.hbs`: The individual partials.

## Creating a New Template

1. Create a new file in `backend/src/email/templates/`, e.g., `my-template.hbs`.
2. Wrap your content in the base layout block:

```handlebars
{{#> base}}
  <h3>Title</h3>
  <p>Hello {{name}}, this is the email content.</p>
{{/base}}
```

3. Call `sendMail()` in `EmailService` and supply the template name and context.

```typescript
await this.mailerService.sendMail({
  to: 'user@example.com',
  subject: 'My Email',
  template: 'my-template', // refers to my-template.hbs
  context: {
    name: 'John Doe',
  },
});
```

## Previewing Templates
A dev-only endpoint `GET /dev/email-preview/:template` allows you to preview the rendered HTML directly in the browser. 

For example:
`http://localhost:3000/dev/email-preview/welcome`

**Note**: Never commit `.env` or real credentials in the template preview fixtures.

## Guidelines
- Keep designs mobile-responsive using inline CSS and max-width.
- Abstract generic components to keep templates clean and maintainable.
