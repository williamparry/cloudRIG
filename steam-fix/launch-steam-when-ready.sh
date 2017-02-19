#!/bin/bash

# Duration of unbindable sockets in TIME_WAIT state is 2 times
# the value of net.inet.tcp.msl. You can change this value as follows:
#
#  sudo sysctl net.inet.tcp.msl=15000
#
# The default is 15000, which produces a 30 second TIME_WAIT delay.

STEAM_PORT=27036

socket_released() {
   [[ $(netstat -an | grep -c "$1") -eq 0 ]] && echo "1"
}

wait_until_free() {
   while true; do
      [[ $(socket_released "$STEAM_PORT") -eq "1" ]] && break
      sleep 1
   done
}

now() {
   date +"%s"
}

START_TS=$(now)
wait_until_free
END_TS=$(now)
printf "Elapsed: %i seconds.\n" "$(( END_TS - START_TS ))"

open -a "Steam.app"