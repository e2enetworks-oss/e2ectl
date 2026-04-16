export async function deleteSavedImage(transport, imageId) {
  await transport.request({
    body: {
      action_type: 'delete_image'
    },
    method: 'PUT',
    path: `/images/${imageId}/`
  });
}
