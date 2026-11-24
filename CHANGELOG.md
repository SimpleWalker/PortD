# Changelog

## 1.1.0

- **Programs that stop responding.** While a program is open, PortD checks every 3 seconds that each program still answers. A program that has not answered for 6 seconds gets a red title bar marked *(Not responding)*, and a red bar at the top offers **Close all programs**, which closes every program window at once and recovers. Built-in apps are not affected. See *When a program stops responding* in [docs/TECHNICAL.md](docs/TECHNICAL.md#programs) and the new *Limits* in the [README](README.md#limits).
- **`P:\OS\Apps` repairs itself.** At start-up and after a restore, a missing or unreadable description of a built-in app is put back. Nothing else in `P:\OS` is changed.
- **Fixed:** the *Backup saved* message could give a size slightly different from the backup file, because it counted the drive after writing the date of the backup into the settings.
- The data format (2), the package format (3), the program API and the security policy are unchanged.

## 1.0.0

- First release.
