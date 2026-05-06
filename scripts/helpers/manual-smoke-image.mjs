export async function deleteSavedImage(transport, imageId) {
  await transport.delete(`/images/${imageId}/`);
}
