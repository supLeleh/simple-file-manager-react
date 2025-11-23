# RIB DUMPS

## Purpose of this file
This file documents how a rib dump file is, justifying the adopted solution on how to parse it in order implement the rib diff feature.


## Differences between IPv4 ribs and IPv6 ribs

Other than the differences in the IPs contained in the ribs itself, there are some differences between the dumps, depending on their provenience and their type:
- rib_v6.dump file contains the 'flags' column, while rib_v4.dump does not
- rib dumps provided by machines (running `bgpctl show rib`) contain a header, which needs to be stripped off

## Rib dump composition
Each rib dump is a file containing multiple lines, where each line represents a single element of the routing information base.

Each line is composed by multiple fields separated by one or more whitespaces.\
The fields for each line are (from left to right):

- **flags**
- **ovs** (origin validation state)
- **destination**
- **gateway**
- **lperf**
- **med**
- **aspath**
- **origin**

Each of this field is a sequence of one or more characters, **except for the aspath field**, which can be composed of one or multiple sequence of characters, separated by one whitespace, for example:

|flags | ovs | destination | gateway | lperf | med | aspath | origin
|----|---|----------------|------------------|-----|---|-------------------|---|
| *> | N | 2a02:27e8::/32 | 2001:7f8:10::137 | 100 | 0 | **137 51708 137 137** | i |

