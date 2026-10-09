# AstraFlow website

Professional agency landing site for selling AI automation services.

## Launch locally

Run `node server.js`, then open [http://localhost:3000](http://localhost:3000). No package installation is required.

## Publish online

The project is ready for a persistent server host such as Render, Railway, Fly.io, or a VPS. It includes a `package.json`, `Dockerfile`, and `render.yaml`.

### Free permanent option: Cloudflare Workers + D1

This is the recommended zero-cost launch option. Cloudflare's Workers Free plan includes up to 100,000 daily dynamic requests; static requests are unlimited. D1's free tier includes 5 GB of storage, 5 million row reads per day, and 100,000 row writes per day—more than enough for an early agency website and lead hub.

1. Create a free Cloudflare account and install the `wrangler` CLI on a computer with npm available.
2. Run `npx wrangler login`, then `npx wrangler d1 create astraflow-leads`.
3. Copy the returned database ID into `wrangler.toml`.
4. Run `npx wrangler d1 execute astraflow-leads --remote --file=schema.sql`.
5. Set secrets: `npx wrangler secret put ASTRAFLOW_API_KEY`, then optionally `N8N_WEBHOOK_URL` and `SLACK_WEBHOOK_URL`.
6. Publish with `npx wrangler deploy`.

Cloudflare returns a free `*.workers.dev` URL. Add a custom domain later if you want one. See [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) for current limits.

### Recommended GitHub + custom-domain setup

Use GitHub as the code home and Cloudflare as the free live application host. GitHub Pages is not suitable for this project because the lead API, dashboard, webhooks, and database need server-side code.

1. Create a new **private** GitHub repository, for example `astraflow-automation-hub`.
2. Push this folder to its `main` branch.
3. Create the free Cloudflare account, D1 database, and secrets using the Cloudflare instructions above.
4. In the GitHub repository, add two Actions secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
5. Push to `main`. The included GitHub Actions workflow automatically deploys the latest version to Cloudflare.
6. Add your existing domain to Cloudflare and change its nameservers at the domain registrar. Then attach the domain to the Worker in Cloudflare.

The `.github/workflows/deploy-cloudflare.yml` workflow contains no secret values; GitHub stores those securely in repository secrets.

### Render deployment

1. Create a private GitHub repository and push this folder to it.
2. In Render, create a new **Blueprint** and select that repository.
3. Render detects `render.yaml`; create the service and wait for the deployment to finish.
4. In Render's environment settings, add `N8N_WEBHOOK_URL` and `SLACK_WEBHOOK_URL` when those accounts are ready.
5. Add your custom domain in Render, then update its DNS records at your domain registrar.

Use a managed database before storing real client records at scale. The built-in JSON files are intentionally excluded from Git and are suitable only for a demo or temporary proof of concept.

## Before publishing

1. Replace **AstraFlow** with your registered agency name if required.
2. Replace the sample testimonials and outcome statements with genuine client approvals.
3. Set `N8N_WEBHOOK_URL` and/or `SLACK_WEBHOOK_URL` as environment variables before running the server. New website leads are sent to those live endpoints.
4. Add your business email, phone/WhatsApp, privacy policy, and terms pages.
5. Host the site on Netlify, Vercel, GitHub Pages, or your preferred web host.

## Included conversion features

- Sticky free-audit call to action
- Lead capture form
- Pricing packages
- Service, industry, and workflow positioning
- Case-study layouts and testimonials
- Interactive automation ROI calculator
- Expandable FAQ
- Responsive navigation and mobile layout
- Real lead API, webhook endpoint, workflow activity log, and Automation Hub dashboard
- Optional n8n and Slack delivery connections
