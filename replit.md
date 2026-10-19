# DOCO storefront

## Project
Existing static website built with HTML, CSS, and vanilla JavaScript. Preserve the existing structure and stack.

## Run on Replit
Use the **Start application** workflow (or the Run button).

Command: `python3 -m http.server 5000 --bind 0.0.0.0`

The server uses Python's standard library; no package installation, build step, or secrets are required. This is a development preview server, not a production server.

## Pages
- `/` or `/index.html`: home page
- `/shop.html`: shop
- `/product.html?sku=multi`: example product

Styles are in `css/style.css`, behavior and product data in `js/main.js`, and images in `assets/`.

## Existing limitations
The cart is stored in the visitor's browser using localStorage. Checkout is explicitly a demo and does not take payment or submit real orders. Google Fonts requires an internet connection.
