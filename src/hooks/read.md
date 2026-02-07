

5. Update your runner app
Add UI for structured status buttons (arrived, in progress, etc.).
Integrate with chat interface for messaging and media.

6. Create a call service
Integrate something like Twilio or Agora for voice/video calls.
Log calls in call_logs linked to task.

7. Update your notification system
Add real-time push notifications for:
New messages
Status updates
Runner offline alerts
Ensure they’re scoped to active tasks only.

8. Create an offline sync layer
Cache messages locally in app.
Implement retry logic for failed sends.
Sync status when back online.

9. Update your monitoring
Add metrics for:
Message delivery success rate
Avg message latency
Status update compliance
Set up alerts for failures.

10. Create admin tooling
Build dashboards to flag tasks with missing or delayed statuses.
Allow support to view task chat and status history.


when i delete a message in runnerchat screen, on user side it should show 

"this message has been deleted" not "you deleted this message" also when i send a media from user side to runner when runner messages back after seeing the image, on runner side i see the image again and when either replies to their own message, info part should show "you" but if they reply to other person message it should be "runner" "user" as the case may be