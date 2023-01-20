// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract UpgradeV1 is Initializable {
    // solhint-disable-next-line var-name-mixedcase
    uint32 public VERSION;

    function initialize() public initializer {
        VERSION = 1;
    }
}
