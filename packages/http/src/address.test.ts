import { BlockList } from "node:net";
import { describe, expect, it } from "vitest";
import { classify } from "./address.js";

const none = new BlockList(); // no own interface addresses, so results do not depend on this machine

describe("classify", () => {
  it.each([
    ["169.254.169.254", "metadata"], ["100.100.100.200", "metadata"], ["fd00:ec2::254", "metadata"],
    ["127.0.0.1", "loopback"], ["127.255.0.9", "loopback"], ["::1", "loopback"],
    ["169.254.1.1", "link-local"], ["fe80::1", "link-local"], ["fe80::1%eth0", "link-local"],
    ["0.0.0.0", "reserved"], ["0.1.2.3", "reserved"], ["224.0.0.1", "reserved"], ["255.255.255.255", "reserved"],
    ["198.18.0.1", "reserved"], ["192.0.2.1", "reserved"], ["::", "reserved"], ["ff02::1", "reserved"],
    ["2001:db8::1", "reserved"], ["2001::1", "reserved"], ["not-an-address", "reserved"],
    ["10.1.2.3", "private"], ["172.16.0.1", "private"], ["192.168.1.1", "private"], ["100.64.0.1", "private"], ["fd12::1", "private"],
    ["8.8.8.8", "public"], ["1.1.1.1", "public"], ["2606:4700:4700::1111", "public"],
  ])("%s is %s", (address, expected) => expect(classify(address, none)).toBe(expected));

  it.each([
    ["::ffff:127.0.0.1", "loopback"], ["::ffff:7f00:1", "loopback"], // IPv4-mapped, dotted and hex
    ["64:ff9b::a9fe:a9fe", "metadata"], // NAT64 of 169.254.169.254
    ["2002:0a00:0001::", "private"], // 6to4 of 10.0.0.1
    ["::ffff:8.8.8.8", "public"],
  ])("unwraps %s to the IPv4 inside it (%s)", (address, expected) => expect(classify(address, none)).toBe(expected));

  it("classifies this machine's own addresses", () => {
    const own = new BlockList();
    own.addAddress("93.184.216.34", "ipv4"); // a VPS's public address held on its own interface
    expect(classify("93.184.216.34", own)).toBe("this-machine");
  });
});
