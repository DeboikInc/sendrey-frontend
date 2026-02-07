export const sendOrderStatusMessage = ({
  statusKey,
  chatId,
  socket,
  taskType = 'shopping'
}) => {
  const mapping = {
    shopping: {
      'on_way_to_location': 'arrived_at_market',
      'arrived_at_location': 'purchase_in_progress',
      'on_way_to_delivery': 'en_route_to_delivery',
      'arrived_at_delivery': 'task_completed',
      'delivered': 'task_completed'
    },
    pickup_delivery: {
      'on_way_to_location': 'arrived_at_pickup_location',
      'arrived_at_location': 'item_collected',
      'on_way_to_delivery': 'en_route_to_delivery',
      'arrived_at_delivery': 'task_completed',
      'delivered': 'task_completed'
    }
  };

  const backendStatus = mapping[taskType]?.[statusKey];
  if (!backendStatus) return;

  // Emit to backend - backend will send system message
  socket.emit('updateStatus', {
    chatId,
    status: backendStatus
  });
};