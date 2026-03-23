export const prerender = true;

export async function load({ fetch }) {
	const [yearRes] = await Promise.all([fetch('strikes_by_year.json')]);
	const strikesbyYear = await yearRes.json();
	return { strikesbyYear };
}
