Issue on Linux : `error while loading shared libraries: libpthread.so.0: cannot open shared object file: No such file or directory`
```
export LD_PRELOAD=/lib/x86_64-linux-gnu/libpthread.so.0
```