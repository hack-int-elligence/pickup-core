# first parameter is file path (full)
# second parameter is the recipient email id

encoded_file="$(cat ${1} | base64)"
echo $encoded_file

file_type="$(file --mime-type ${1})"
echo $file_type

recipient="${2}"
echo $recipient


curl -A 'Mandrill-Curl/1.0' -d '{"key":"cCB0AkwTdLJJFjW9ARZGdA","message":{"html":"","text":"Your file is here!","subject":"Pickup Delivery!","from_email":"akshatag@seas.upenn.edu","from_name":"Pickup Mailman","to":[{"email":"'"$recipient"'","name":"","type":"to"}],"headers":{"Reply-To":"message.reply@example.com"},"important":false,"track_opens":null,"track_clicks":null,"auto_text":null,"auto_html":null,"inline_css":null,"url_strip_qs":null,"preserve_recipients":null,"view_content_link":null,"bcc_address":null,"tracking_domain":null,"signing_domain":null,"return_path_domain":null,"merge":true,"merge_language":"mailchimp","global_merge_vars":[{"name":"merge1","content":"merge1 content"}],"merge_vars":null,"tags":null,"subaccount":null,"google_analytics_domains" : null,"google_analytics_campaign": null,"metadata":{"website":"www.example.com"},"recipient_metadata":null,"attachments":[{"type":"'"$file_type"'","name":"file","content":"'"$encoded_file"'"}],"images":[{"type":"image\/png","name":"IMAGECID","content":"ZXhhbXBsZSBmaWxl"}]},"async":false,"ip_pool":"Main Pool"}' 'https://mandrillapp.com/api/1.0/messages/send.json'