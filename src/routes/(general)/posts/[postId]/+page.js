/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  return {
    postId: params.postId,
  };
}
