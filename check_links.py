import json
import logging

import requests
from urllib3.exceptions import InsecureRequestWarning
from collections import Counter


def check_links(url):
    """
    Check links in a given url.
    """
    requests.packages.urllib3.disable_warnings(category=InsecureRequestWarning)
    try:
        response = requests.get(url, verify=False)
        status = response.status_code
        status_code_results[url] = status
        return status
    except requests.exceptions.RequestException as error:
        error_results[url] = error
        return error


# Configuration logging
logging.basicConfig(level=logging.INFO)

# Read json file
json_file = open("data/data.json")

# Load json file
data = json.load(json_file)

status_code_results = {}
error_results = {}

for item in data:
    website_url = item["website"]
    delete_url = item["deleteurl"]
    check_links(website_url)
    if delete_url != "#":
        check_links(delete_url)


counter = Counter(status_code_results)
status_code_results = dict(counter.most_common())

for url, error in error_results.items():
    logging.error(f" {url} returned an error: {error}")


for url, status_code in status_code_results.items():
    logging.info(f" {url} returned a {status_code} status code")
