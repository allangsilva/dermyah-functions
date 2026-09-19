deploy:
	gcloud app deploy --project=dermyah

deploy-cron:	
	gcloud app deploy cron.yaml --project=dermyah 

logs: 
	gcloud app logs tail -s default