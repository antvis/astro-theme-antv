import type { APIRoute, GetStaticPaths } from 'astro';
import { exampleMenuData } from '../lib/example-menu';
import { config, registry } from '../lib/site';

export const getStaticPaths: GetStaticPaths = () => config.site.locales.map((locale) => ({
  params: { locale },
  props: { menu: exampleMenuData(registry.categories, locale) },
}));

export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(props.menu), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
