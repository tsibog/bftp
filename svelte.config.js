import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		warningFilter: (warning) => warning.code !== 'state_referenced_locally'
	},
	kit: {
		adapter: adapter()
	}
};

export default config;
