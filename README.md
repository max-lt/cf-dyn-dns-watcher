# Cloudflare dyn dns updater

environment variables to pass to the container:
- INTERVAL=number in millisecond: interval to check your ip 
- CF_EMAIL= your cloudflare email
- CF_ZONE= cloudflare targeted zone
- CF_KEY= your cloudflare api key
- CF_TARGET_ID= cloudflare target id (optional)
- CF_TARGET_TYPE= cloudflare target type (not required if id provided, paired with CF_TARGET_NAME)
- CF_TARGET_NAME= cloudflare target name (not required if id provided, paired with CF_TARGET_TYPE)

### Todo:
- allow multiple targets

### External services
This service calls "api.ipify.org" to get the address.
