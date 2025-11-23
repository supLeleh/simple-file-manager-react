import re

RIB_REGEX = r"[VN!].*? [aie]"

# returns True if the given line is considered to be part of the header
def isHeader(line: str):
    words = ["flags", "Valid", "Selected", "Announced", "Stale", "Error", "origin", "Incomplete", "ovs", "destination", "origin"]
    return any(word in line for word in words)

# A Ribline indentifies a single line of a rib dump, composed of multiple entries
class RibLine:

    params: list[str]

    def __init__(self, line: str, strip_heading: str = None) -> None:
        tmp = line.split()
        if len(line) < 7:
            print("valerr ", line)
            raise ValueError(f"the given line '{line}' is not valid to create a RibLine")
        self.params = tmp

    def __hash__(self):
        return hash(tuple(self.params))

    # for two rib line to be considered the same, they have to have identical fields
    def __eq__ (self, other):
        if isinstance(other, RibLine):
            return self.params == other.params
        else:
            return False


# A RibDump identifies an entire RibDump, where each line is a RibLine
class RibDump:
    rib_lines: set[RibLine]

    def __init__(self, dump_content: list | str) -> None:
        self.rib_lines = set()
        # the dump_content provided by command execution on the machine returns a list of strings as output
        if isinstance(dump_content, list):
            """
            We merge the dump_content into a single string, to do so, we concat
            each element, BUT when the element ens with "e" or "i", we append a newline
            to enable the correct splitting done at line 53
            """
            dump_content_merged = ""
            for e in dump_content:
                dump_content_merged += e
                if e.endswith(("e", "i")):
                    dump_content_merged += "\n"
                else:   
                    e += " "
            for line in dump_content_merged.split("\n"):
                if line == "" or isHeader(line):
                    print(f"Line skipped due to being not valid: {line}")
                    continue
                line = " ".join(line.split())
                self.rib_lines.add(RibLine(re.findall(RIB_REGEX, line)[0]))
        # reading the dump_content from file returns a string
        if isinstance(dump_content, str):
            dump_content = " ".join(dump_content.split())
            dump_content = re.findall(RIB_REGEX, dump_content)
            for line in dump_content:
                self.rib_lines.add(RibLine(line))


    def intersection(self, other: 'RibDump') -> set[RibLine]:
        return self.rib_lines & other.rib_lines
    
    def difference(self, other: 'RibDump') -> set[RibLine]:
        return self.rib_lines - other.rib_lines
    
    def symmetric_difference(self, other: 'RibDump') -> set[RibLine]:
        return self.rib_lines ^ other.rib_lines

    